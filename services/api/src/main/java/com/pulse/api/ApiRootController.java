package com.pulse.api;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class ApiRootController {
    @GetMapping("/")
    public Map<String, String> root() {
        return Map.of(
                "service", "Pulse API",
                "status", "ok",
                "healthEndpoint", "/api/health");
    }
}