package com.pulse.api;

import com.google.api.core.ApiFuture;
import com.google.cloud.Timestamp;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.google.cloud.firestore.QuerySnapshot;
import com.google.cloud.firestore.Transaction;
import com.google.cloud.firestore.FirestoreOptions;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@Repository
public class FirestorePersistence {
    private final boolean enabled;
    private final Firestore firestore;

    public FirestorePersistence(@Value("${pulse.firestore.enabled:false}") boolean enabled) {
        this.enabled = enabled;
        this.firestore = enabled ? FirestoreOptions.getDefaultInstance().getService() : null;
    }

    public List<ScenarioController.WorkOrder> listWorkOrders(List<ScenarioController.WorkOrder> fallback) {
        if (!enabled) return List.copyOf(fallback);

        QuerySnapshot snapshot = await(firestore.collection("work_orders").orderBy("createdAt").get());
        if (snapshot.isEmpty()) {
            fallback.forEach(this::saveWorkOrder);
            return List.copyOf(fallback);
        }

        List<ScenarioController.WorkOrder> orders = new ArrayList<>();
        for (QueryDocumentSnapshot document : snapshot.getDocuments()) {
            orders.add(toWorkOrder(document));
        }
        return List.copyOf(orders);
    }

    public List<ScenarioController.TechnicianValidation> listValidations(
            List<ScenarioController.TechnicianValidation> fallback) {
        if (!enabled) return List.copyOf(fallback);

        QuerySnapshot snapshot = await(firestore.collection("technician_validations")
                .orderBy("recordedAt").get());
        List<ScenarioController.TechnicianValidation> validations = new ArrayList<>();
        for (QueryDocumentSnapshot document : snapshot.getDocuments()) {
            validations.add(toValidation(document));
        }
        return List.copyOf(validations);
    }

    public void saveValidation(ScenarioController.TechnicianValidation validation) {
        if (!enabled) return;
        await(firestore.collection("technician_validations")
                .document(validation.id()).set(validationDocument(validation)));
    }

    public void saveWorkOrder(ScenarioController.WorkOrder order) {
        if (!enabled) return;
        await(firestore.collection("work_orders")
                .document(order.id()).set(workOrderDocument(order)));
    }

    public String nextWorkOrderId(int fallbackNextId) {
        if (!enabled) return "WO-" + fallbackNextId;

        DocumentReference counter = firestore.collection("pulse_metadata").document("work_order_counter");
        return await(firestore.runTransaction(transaction -> {
            DocumentSnapshot snapshot = transaction.get(counter).get();
            Long storedNextId = snapshot.getLong("nextId");
            long nextId = storedNextId == null ? fallbackNextId : storedNextId;
            transaction.set(counter, Map.of("nextId", nextId + 1));
            return "WO-" + nextId;
        }));
    }

    @PreDestroy
    public void close() {
        if (firestore != null) {
            try {
                firestore.close();
            } catch (Exception ignored) {
                // Shutdown should not fail if the client was already closed.
            }
        }
    }

    private Map<String, Object> workOrderDocument(ScenarioController.WorkOrder order) {
        Map<String, Object> data = new HashMap<>();
        data.put("id", order.id());
        data.put("assetId", order.assetId());
        data.put("task", order.task());
        data.put("plan", order.plan());
        data.put("maintenanceWindow", order.maintenanceWindow());
        data.put("partNumber", order.partNumber());
        data.put("quantity", order.quantity());
        data.put("requiredSkill", order.requiredSkill());
        data.put("estimatedHours", order.estimatedHours());
        data.put("safetyChecks", order.safetyChecks());
        data.put("status", order.status());
        data.put("requiredApprovals", order.requiredApprovals());
        data.put("technicianObservation", order.technicianObservation());
        data.put("createdAt", timestamp(order.createdAt()));
        return data;
    }

    private Map<String, Object> validationDocument(ScenarioController.TechnicianValidation validation) {
        Map<String, Object> data = new HashMap<>();
        data.put("id", validation.id());
        data.put("alertId", validation.alertId());
        data.put("technician", validation.technician());
        data.put("diagnosis", validation.diagnosis());
        data.put("observation", validation.observation());
        data.put("action", validation.action());
        data.put("recordedAt", timestamp(validation.recordedAt()));
        return data;
    }

    private ScenarioController.WorkOrder toWorkOrder(DocumentSnapshot document) {
        return new ScenarioController.WorkOrder(
                document.getString("id"),
                document.getString("assetId"),
                document.getString("task"),
                document.getString("plan"),
                document.getString("maintenanceWindow"),
                document.getString("partNumber"),
                number(document, "quantity").intValue(),
                document.getString("requiredSkill"),
                number(document, "estimatedHours").doubleValue(),
                stringList(document, "safetyChecks"),
                document.getString("status"),
                stringList(document, "requiredApprovals"),
                document.getString("technicianObservation"),
                instant(document.getTimestamp("createdAt")));
    }

    private ScenarioController.TechnicianValidation toValidation(DocumentSnapshot document) {
        return new ScenarioController.TechnicianValidation(
                document.getString("id"),
                document.getString("alertId"),
                document.getString("technician"),
                document.getString("diagnosis"),
                document.getString("observation"),
                document.getString("action"),
                instant(document.getTimestamp("recordedAt")));
    }

    private Number number(DocumentSnapshot document, String field) {
        Object value = document.getData().get(field);
        if (value instanceof Number number) return number;
        throw new IllegalStateException("Missing numeric Firestore field: " + field);
    }

    @SuppressWarnings("unchecked")
    private List<String> stringList(DocumentSnapshot document, String field) {
        List<String> values = (List<String>) document.get(field);
        return values == null ? List.of() : List.copyOf(values);
    }

    private Timestamp timestamp(Instant instant) {
        return Timestamp.ofTimeSecondsAndNanos(instant.getEpochSecond(), instant.getNano());
    }

    private Instant instant(Timestamp timestamp) {
        return timestamp == null ? Instant.EPOCH : timestamp.toSqlTimestamp().toInstant();
    }

    private <T> T await(ApiFuture<T> future) {
        try {
            return future.get();
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while accessing Firestore", ex);
        } catch (ExecutionException ex) {
            throw new IllegalStateException("Firestore operation failed", ex.getCause());
        }
    }
}