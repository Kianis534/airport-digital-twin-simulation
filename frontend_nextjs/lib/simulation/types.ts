// Shapes shared by the in-browser engine and the FastAPI service (snake_case on purpose:
// both return exactly the same JSON).

export type SecurityTech = 'standard' | 'advanced';

export interface ScenarioConfig {
  scenario_name: string;
  checkin_counters: number;
  security_lanes: number;
  boarding_gates: number;
  traffic_increase_pct: number;
  delay_offset_min: number;
  weather_severity: number;
  security_tech: SecurityTech;
  duration_minutes: number;
  base_departures_per_hour: number;
  international_share: number;
  forecast_month: number | null;
  start_hour: number;
  seed: number | null;
}

export interface Kpis {
  flights: number;
  passengers: number;
  boarded: number;
  missed_passengers: number;
  missed_rate: number;
  flights_with_missed_passengers: number;
  avg_checkin_wait_min: number;
  p95_checkin_wait_min: number;
  avg_security_wait_min: number;
  p95_security_wait_min: number;
  max_security_wait_min: number;
  max_checkin_queue: number;
  max_security_queue: number;
  avg_time_to_gate_min: number;
  avg_departure_delay_min: number;
  on_time_departure_rate: number;
  gate_conflicts: number;
  checkin_utilization: number;
  security_utilization: number;
  gate_utilization: number;
  avg_satisfaction: number;
  satisfied_share: number;
  throughput_per_hour: number;
  operating_window_min: number;
}

export interface Snapshot {
  t: number;
  clock: string;
  checkin_queue: number;
  security_queue: number;
  checkin_busy: number;
  security_busy: number;
  in_terminal: number;
  at_gate: number;
  boarded: number;
  missed: number;
  gates_in_use: number;
}

export interface WaitBucket {
  bucket: string;
  checkin: number;
  security: number;
}

export interface FlightRecord {
  flight_id: string;
  airline: string;
  international: boolean;
  scheduled: string;
  departed: string;
  delay_min: number;
  gate_wait_min: number;
  passengers: number;
  boarded: number;
  missed: number;
}

export type Severity = 'critical' | 'warning' | 'info' | 'ok';

export interface Recommendation {
  severity: Severity;
  area: string;
  title: string;
  detail: string;
  action: string;
}

export interface ServiceLevel {
  name: string;
  target: string;
  value: number;
  met: boolean;
}

export interface EngineInfo {
  version: string;
  seed: number;
  runtime_ms: number;
  delay_model: string;
  satisfaction_model: string;
  demand_model: string;
  demand_multiplier: number;
}

export interface SimulationResult {
  scenario: ScenarioConfig;
  kpis: Kpis;
  service_levels: ServiceLevel[];
  time_series: Snapshot[];
  wait_distribution: WaitBucket[];
  flights: FlightRecord[];
  recommendations: Recommendation[];
  engine: EngineInfo;
}

export interface ProcessParameters {
  first_departure: number;
  peak_profile: number[];
  seat_options: number[];
  seat_weights: number[];
  load_factor_range: [number, number];
  domestic_distance: [number, number];
  international_distance: [number, number];
  congestion_reference: number;
  arrival_mean_domestic: number;
  arrival_mean_international: number;
  arrival_sd: number;
  arrival_bounds: [number, number];
  checkin_share_domestic: number;
  checkin_share_international: number;
  checkin_service: [number, number, number];
  security_service: [number, number, number];
  walk_to_gate: [number, number];
  passport_control: number;
  boarding_service: [number, number];
  boarding_lanes_per_gate: number;
  gate_request_lead: number;
  min_gate_time: number;
  boarding_lead: number;
  gate_close_lead: number;
  pushback: number;
  weather_delay_max: number;
  weather_boarding_slowdown: number;
  target_utilization: number;
  sla_security_p95: number;
  sla_checkin_p95: number;
  sla_missed_rate: number;
  sla_on_time_rate: number;
  monitor_interval: number;
}
