package com.pulse.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

@RestController
@RequestMapping("/api")
public class ScenarioController {

    private final List<TechnicianValidation> validations = new ArrayList<>();
    private final List<WorkOrder> workOrders;
    private final AtomicInteger nextWorkOrder = new AtomicInteger(2481);
    private final GeminiService geminiService;
    private final FirestorePersistence firestorePersistence;

    public ScenarioController(GeminiService geminiService, FirestorePersistence firestorePersistence) {
        this.geminiService = geminiService;
        this.firestorePersistence = firestorePersistence;
        workOrders = new ArrayList<>(List.of(
            new WorkOrder("WO-2479", "P-101B", "Valve seat replacement — isolation valve IV-201",
                "scheduled", "Today · 09:00", "VLV-201-SEAT", 1, "Mechanical", 3.0,
                List.of("LOTO applied", "Pressure bled", "Valve free of stored energy"),
                "IN_PROGRESS", List.of("Area authority"),
                "Valve passing — internal seat worn. Replacement confirmed.", Instant.now().minusSeconds(10800)),
            new WorkOrder("WO-2477", "M-204", "Annual oil change and filter replacement",
                "scheduled", "Yesterday · 08:00", "OIL-ISO-68", 2, "Mechanical", 1.5,
                List.of("Motor isolated and tagged", "Oil drained and disposed correctly"),
                "COMPLETED", List.of(),
                "As expected — oil black at 6 months. Filter 60% blocked. Replaced both items.", Instant.now().minusSeconds(86400)),
            new WorkOrder("WO-2475", "C-312", "Compressor belt and pulley inspection",
                "scheduled", "Monday · 14:00", "BELT-C312-02", 1, "Mechanical", 2.0,
                List.of("Energy isolation verified", "Guard removal documented"),
                "APPROVED", List.of("Maintenance supervisor"), "", Instant.now().minusSeconds(259200))
        ));
    }

    @GetMapping("/health")
    public Health health() {
        return new Health("ok", "Pulse API", Instant.now());
    }

    @GetMapping("/overview")
    public Overview overview() {
        return new Overview(
                "Northline plant", "Site 04 · Indiana",
                new PlantMetrics(3, 96.8, 7, 2.4),
                List.of(
                        new Asset("P-101A", "Primary transfer pump", "Production · Line 2", "DEGRADING", 68, 94.2, "2026-01-12", "Maya Chen"),
                        new Asset("P-101B", "Standby transfer pump", "Production · Line 2", "HEALTHY", 21, 99.8, "2026-03-04", "James Reed"),
                        new Asset("M-204", "Mixer drive motor", "Blending · Line 1", "HEALTHY", 18, 98.7, "2026-02-21", "A. Kumar"),
                        new Asset("C-312", "Cooling water compressor", "Utilities · East", "MONITOR", 44, 96.1, "2025-12-18", "James Reed"),
                        new Asset("F-118", "Process feed filter", "Production · Line 3", "HEALTHY", 14, 99.5, "2026-04-02", "Maya Chen"),
                        new Asset("HX-207", "Heat exchanger unit", "Utilities · West", "HEALTHY", 22, 98.1, "2026-03-15", "A. Kumar"),
                        new Asset("V-305", "Storage vessel agitator", "Blending · Line 2", "HEALTHY", 11, 99.9, "2026-05-01", "James Reed"),
                        new Asset("P-201A", "Secondary cooling pump", "Utilities · East", "HEALTHY", 19, 98.6, "2026-02-08", "Maya Chen")
                ),
                primaryAlert(),
                firestorePersistence.listValidations(validations),
                firestorePersistence.listWorkOrders(workOrders)
        );
    }

    @GetMapping("/alerts/P-101A")
    public Alert primaryAlert() {
        return new Alert(
                "ALT-1042", "P-101A", "Bearing degradation detected",
                "Drive-end vibration has risen 31% over five days. Bearing temperature and motor current are trending up under comparable load. Pattern resembles 2 previous bearing-wear cases.",
                87, "5–8 days", "MODERATE",
                new SignalReading(5.8, "mm/s", 3.2, 8.0, 31),
                new SignalReading(73, "°C", 62, 90, 11),
                new SignalReading(47, "A", 41, 60, 15),
                new SignalReading(9.0, "bar", 8.5, 9.5, 0),
                10.5, "ACTIVE",
                List.of("Bearing wear", "Misalignment"),
                List.of("P-099B · Bearing wear · Resolved 3 months ago", "P-101A · Alignment check · Resolved 8 months ago")
        );
    }

    @GetMapping("/alerts")
    public List<Alert> listAlerts() {
        return List.of(
                primaryAlert(),
                new Alert("ALT-1039", "C-312", "Cooling efficiency declining",
                        "Cooling water flow rate has dropped 12% over two weeks. Compressor discharge temperature rising. Pattern consistent with fouled heat exchanger or partially blocked strainer.",
                        72, "12–18 days", "LOW",
                        new SignalReading(3.8, "m³/h", 4.2, 4.6, -12),
                        new SignalReading(48, "°C", 42, 55, 14),
                        new SignalReading(52, "A", 48, 65, 8),
                        new SignalReading(7.2, "bar", 6.8, 7.6, 0),
                        9.0, "ACTIVE",
                        List.of("Heat exchanger fouling", "Blocked strainer"),
                        List.of("C-312 · Strainer clean · 14 months ago")),
                new Alert("ALT-1035", "F-118", "Differential pressure normalised",
                        "Filter differential pressure returned to normal range after cleaning. Monitoring continues to confirm stability.",
                        92, "N/A", "LOW",
                        new SignalReading(0.3, "bar", 0.1, 0.5, 0),
                        new SignalReading(22, "°C", 18, 35, 0),
                        new SignalReading(12, "A", 10, 18, 0),
                        new SignalReading(5.1, "bar", 4.8, 5.4, 0),
                        7.0, "CLOSED",
                        List.of("Resolved — filter cleaned"),
                        List.of())
        );
    }

    @PostMapping("/alerts/P-101A/validation")
    public TechnicianValidation validate(@Valid @RequestBody ValidationRequest request) {
        TechnicianValidation validation = new TechnicianValidation(
            "VAL-" + UUID.randomUUID(), "ALT-1042",
                request.technician(), request.diagnosis(),
                request.observation(), request.action(), Instant.now());
        validations.add(validation);
        firestorePersistence.saveValidation(validation);
        return validation;
    }

    @GetMapping("/work-orders")
    public List<WorkOrder> listWorkOrders() {
        return firestorePersistence.listWorkOrders(workOrders);
    }

    @PostMapping("/work-orders")
    public WorkOrder createWorkOrder(@Valid @RequestBody WorkOrderRequest request) {
        if (!List.of("immediate", "reduced", "tomorrow").contains(request.plan())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown intervention plan");
        }
        String id = firestorePersistence.nextWorkOrderId(nextWorkOrder.getAndIncrement());
        WorkOrder order = new WorkOrder(
                id, "P-101A", "Inspect drive-end bearing and verify alignment",
                request.plan(), request.window(), "BRG-6208", 1, "Rotating equipment", 2.5,
                List.of("LOTO review", "Stored energy verification", "Bearing temperature acceptance check"),
                "DRAFT", List.of("Maintenance supervisor", "Area authority"),
                request.technicianObservation(), Instant.now());
        workOrders.add(order);
        firestorePersistence.saveWorkOrder(order);
        return order;
    }

    @PutMapping("/work-orders/{id}/outcome")
    public WorkOrder recordOutcome(@PathVariable String id, @Valid @RequestBody OutcomeRequest req) {
        for (int i = 0; i < workOrders.size(); i++) {
            WorkOrder wo = workOrders.get(i);
            if (wo.id().equals(id)) {
                WorkOrder closed = new WorkOrder(
                        wo.id(), wo.assetId(), wo.task(), wo.plan(), wo.maintenanceWindow(),
                        wo.partNumber(), wo.quantity(), wo.requiredSkill(), wo.estimatedHours(),
                        wo.safetyChecks(), "COMPLETED", wo.requiredApprovals(),
                        req.actualFinding(), wo.createdAt());
                workOrders.set(i, closed);
                firestorePersistence.saveWorkOrder(closed);
                return closed;
            }
        }
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Work order not found");
    }

    @GetMapping("/sensors/P-101A/live")
    public SensorSnapshot liveSnapshot() {
        long s = Instant.now().getEpochSecond();
        double t = (s % 420) / 420.0; // 7-minute simulation loop (1 min = 1 day)
        double v  = round1(3.1  + t * 2.7  + Math.sin(s * 0.31) * 0.09);
        double bt = round1(62.0 + t * 11.0 + Math.sin(s * 0.19) * 0.25);
        double mc = round1(41.0 + t * 6.0  + Math.sin(s * 0.23) * 0.18);
        double p  = round2(9.0  + Math.sin(s * 0.07) * 0.07);
        int score = Math.min((int)(35 + t * 60), 95);
        return new SensorSnapshot(v, bt, mc, p, score, Instant.now());
    }

    @PostMapping("/copilot")
    public CopilotResponse copilot(@RequestBody CopilotRequest req) {
        if (geminiService.isConfigured()) {
            try {
                String answer = geminiService.answer(req.question(), req.context());
                return new CopilotResponse(answer,
                        List.of("Gemini 2.5 Flash · Google AI Studio"),
                        "AI-generated · verify before operational action", Instant.now());
            } catch (RuntimeException ex) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "AI assistance is temporarily unavailable");
            }
        }
        String q = req.question() == null ? "" : req.question().toLowerCase();

        if (q.contains("pressure") || q.contains("bar") || q.contains("9 bar") || q.contains("7 bar") || q.contains("baseline")) {
            return new CopilotResponse(
                "P-101A operates at 9.0 bar — its actual learned baseline, not the 7 bar listed in the original engineering document. Pulse observed 180 days of operation to establish this. The current reading is within the asset's learned normal range (8.5–9.5 bar) and well below the approved safety limit of 10.5 bar. No pressure alarm is warranted.",
                List.of("Operating baseline · 180-day history", "Engineering limit sheet EL-101A", "Safety management system"),
                "High", Instant.now());
        }
        if (q.contains("vibration") || q.contains("mm/s") || q.contains("vib")) {
            return new CopilotResponse(
                "Drive-end vibration has risen from 3.1 mm/s on Monday to 5.8 mm/s today — a 31% increase over 5 days. The rate of change has accelerated since Thursday, and the current value is 38% above the 4.2 mm/s learned upper baseline. This pattern closely matches bearing-wear signatures from P-099B (July 2026) and P-101A's own alignment event in March 2026.",
                List.of("Maintenance record MR-0892 · P-099B bearing wear", "Maintenance record MR-0744 · P-101A alignment", "ISO 10816-3 vibration limits"),
                "High", Instant.now());
        }
        if (q.contains("bearing") || q.contains("fail") || q.contains("time to") || q.contains("when")) {
            return new CopilotResponse(
                "Based on the current vibration trajectory and ISO 10816 bearing-wear signatures, estimated time to threshold exceedance is 5–8 days. However, the technician has noted a rough sound from the drive-end bearing, which typically indicates advanced wear. Uncertainty is moderate — recommend not extending beyond the 18:00 maintenance window today.",
                List.of("ISO 10816-3 vibration standard", "Technician note · Maya Chen · 2 hours ago", "Failure mode library · Bearing wear progression"),
                "Medium", Instant.now());
        }
        if (q.contains("standby") || q.contains("p-101b") || q.contains("pump b") || q.contains("backup")) {
            return new CopilotResponse(
                "P-101B (standby transfer pump) is confirmed healthy with a health score of 21/100. It is out of service since 09:00 today for scheduled valve maintenance (WO-2479) and is expected to return at 17:00. This is the key scheduling constraint driving the 18:00 maintenance window recommendation. Running P-101A at reduced load (70%) until 17:00 keeps vibration within safe limits.",
                List.of("Work order WO-2479 · P-101B valve seat replacement", "Standby pump availability schedule", "Process safety assessment · Reduced load operating mode"),
                "High", Instant.now());
        }
        if (q.contains("part") || q.contains("stock") || q.contains("brg") || q.contains("inventory") || q.contains("material")) {
            return new CopilotResponse(
                "Recommended replacement: BRG-6208 deep-groove ball bearing × 1, confirmed in stock (3 units at warehouse bin D4-12). Additional consumables: NLGI 2 bearing grease, alignment shims, and safety wire. All materials are on-site — no procurement lead time required. Estimated total task time: 2.5 hours including isolation and reinstatement.",
                List.of("Parts inventory · Site 04 warehouse", "Task procedure TP-P101-BRG-01", "Bill of materials · P-101A bearing replacement"),
                "High", Instant.now());
        }
        if (q.contains("recommend") || q.contains("what should") || q.contains("action") || q.contains("next step") || q.contains("what do")) {
            return new CopilotResponse(
                "Recommended course of action: (1) Reduce P-101A load to 70% immediately to slow bearing degradation. (2) Set enhanced vibration alarm at 6.5 mm/s for the interim period. (3) At 16:30, confirm hot work permit has cleared Line 2. (4) At 17:00, confirm P-101B has returned to service and is running stably. (5) Shut down P-101A at 18:00 and begin drive-end bearing inspection. (6) Collect BRG-6208 × 1 from warehouse bin D4-12. Two supervisor approvals are required before job start.",
                List.of("Intervention readiness assessment", "Maintenance procedure MP-101A-02", "Permit to work requirements · Line 2"),
                "High", Instant.now());
        }
        if (q.contains("temperature") || q.contains("heat") || q.contains("thermal") || q.contains("hot")) {
            return new CopilotResponse(
                "Drive-end bearing temperature has risen from 62°C on Monday to 73°C today — an 11°C increase over 5 days. The ISO 10816 warning threshold for this bearing type is 80°C. At the current rate (~1.5°C/day), the warning threshold would be reached in approximately 5 days — consistent with the vibration-based estimate. Rising temperature corroborates progressive bearing degradation.",
                List.of("ISO 10816-3 thermal limits", "OEM bearing specification · BRG-6208 datasheet", "Asset monitoring report · P-101A"),
                "Medium", Instant.now());
        }
        if (q.contains("history") || q.contains("previous") || q.contains("similar") || q.contains("case")) {
            return new CopilotResponse(
                "There are 2 similar cases in the maintenance history. P-099B experienced bearing wear in July 2026: vibration rose from 3.0 to 6.1 mm/s over 6 days before scheduled replacement. P-101A itself had a misalignment event in March 2026 where vibration reached 5.4 mm/s — bearing alignment corrected it. The current pattern more closely resembles P-099B (wear), not the alignment case.",
                List.of("Maintenance record MR-0892 · P-099B bearing wear · July 2026", "Maintenance record MR-0744 · P-101A alignment event · March 2026", "Failure mode comparison · RAG retrieval"),
                "High", Instant.now());
        }
        // Default / general asset query
        return new CopilotResponse(
            "P-101A is the primary transfer pump on Production Line 2 at Northline Plant (Site 04). It has been showing combined bearing degradation signals for 5 days: vibration +31%, bearing temperature +11°C, motor current +15%. The asset health score is 68/100 (At Risk). Root cause analysis points to drive-end bearing wear with possible misalignment, supported by pattern matching with 2 historical cases. Recommended intervention: today at 18:00.",
            List.of("Asset profile · P-101A", "Alert ALT-1042 · Bearing degradation", "Historical maintenance records · 2 similar cases"),
            "Medium", Instant.now());
    }

    @GetMapping("/events")
    public List<EventRecord> events() {
        long now = Instant.now().getEpochSecond();
        return List.of(
                new EventRecord("EVT-008", "ALERT", "P-101A", "Bearing degradation alert raised — confidence 87%", "HIGH", Instant.ofEpochSecond(now - 7200)),
                new EventRecord("EVT-007", "THRESHOLD", "P-101A", "Vibration exceeded learned upper bound (4.2 mm/s)", "MEDIUM", Instant.ofEpochSecond(now - 18000)),
                new EventRecord("EVT-006", "VALIDATION", "P-101A", "Maya Chen confirmed bearing degradation diagnosis", "INFO", Instant.ofEpochSecond(now - 1800)),
                new EventRecord("EVT-005", "WORK_ORDER", "P-101B", "WO-2479 started · Valve seat replacement in progress", "INFO", Instant.ofEpochSecond(now - 10800)),
                new EventRecord("EVT-004", "THRESHOLD", "P-101A", "Bearing temperature reached 70°C — trending upward", "MEDIUM", Instant.ofEpochSecond(now - 43200)),
                new EventRecord("EVT-003", "COMPLETED", "M-204", "WO-2477 closed · Oil change confirmed successful", "INFO", Instant.ofEpochSecond(now - 86400))
        );
    }

    // ── Records ──────────────────────────────────────────────────────────────
    public record Health(String status, String service, Instant timestamp) {}
    public record PlantMetrics(int activeAlerts, double availabilityPercent, int readyWorkOrders, double downtimeHours) {}
    public record Asset(String id, String name, String area, String condition, int healthScore, double availabilityPercent, String lastService, String owner) {}
    public record SignalReading(double value, String unit, double baselineMin, double baselineMax, int changePercent) {}
    public record Alert(String id, String assetId, String title, String explanation, int confidencePercent,
                        String estimatedTimeToFailure, String uncertainty, SignalReading vibration,
                        SignalReading bearingTemperature, SignalReading motorCurrent, SignalReading pressure,
                        double approvedPressureLimit, String status,
                        List<String> possibleFailureModes, List<String> similarCases) {}
    public record Overview(String site, String location, PlantMetrics metrics, List<Asset> assets,
                           Alert priorityAlert, List<TechnicianValidation> validations, List<WorkOrder> workOrders) {}
    public record ValidationRequest(@NotBlank String technician, @NotBlank String diagnosis,
                                    String observation, @NotBlank String action) {}
    public record TechnicianValidation(String id, String alertId, String technician, String diagnosis,
                                       String observation, String action, Instant recordedAt) {}
    public record WorkOrderRequest(@NotBlank String plan, @NotBlank String window,
                                   @NotBlank String technician, String technicianObservation) {}
    public record WorkOrder(String id, String assetId, String task, String plan, String maintenanceWindow,
                            String partNumber, int quantity, String requiredSkill, double estimatedHours,
                            List<String> safetyChecks, String status, List<String> requiredApprovals,
                            String technicianObservation, Instant createdAt) {}
    public record SensorSnapshot(double vibration, double bearingTemperature, double motorCurrent,
                                 double pressure, int anomalyScore, Instant recordedAt) {}
    public record CopilotRequest(String question, String context) {}
    public record CopilotResponse(String answer, List<String> sources, String confidence, Instant timestamp) {}
    public record EventRecord(String id, String type, String assetId, String message, String severity, Instant occurredAt) {}
    public record OutcomeRequest(@NotBlank String actualFinding, @NotBlank String actionTaken,
                                 String partConsumed, boolean predictionCorrect) {}

    private static double round1(double v) { return Math.round(v * 10.0) / 10.0; }
    private static double round2(double v) { return Math.round(v * 100.0) / 100.0; }
}
