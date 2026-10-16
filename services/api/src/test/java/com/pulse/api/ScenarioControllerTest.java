package com.pulse.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class ScenarioControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @Test
    void alertExplainsLearnedPressureBaselineAndDegradationEvidence() throws Exception {
        mockMvc.perform(get("/api/alerts/P-101A"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assetId").value("P-101A"))
                .andExpect(jsonPath("$.pressure.value").value(9.0))
                .andExpect(jsonPath("$.pressure.approvedPressureLimit").doesNotExist())
                .andExpect(jsonPath("$.approvedPressureLimit").value(10.5))
                .andExpect(jsonPath("$.vibration.changePercent").value(31));
    }

    @Test
    void technicianCanValidateDiagnosisAndDraftSelectedMaintenanceWindow() throws Exception {
        mockMvc.perform(post("/api/alerts/P-101A/validation")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"technician":"Maya Chen","diagnosis":"Bearing degradation","observation":"Rough drive-end sound","action":"CONFIRM_DIAGNOSIS"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.technician").value("Maya Chen"))
                .andExpect(jsonPath("$.observation").value("Rough drive-end sound"));

        mockMvc.perform(post("/api/work-orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"plan":"reduced","window":"Today · 18:00","technician":"Maya Chen","technicianObservation":"Check alignment first"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("WO-2481"))
                .andExpect(jsonPath("$.maintenanceWindow").value("Today · 18:00"))
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.requiredApprovals.length()").value(2));
    }
}