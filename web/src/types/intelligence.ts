export interface School {
  id: string;
  name_en: string;
  name_hi: string;
  lat: number;
  lon: number;
  locality_id: string;
  school_type: string;
  nearest_station_id: string;
  station_distance_km: number;
  student_count: number;
}

export interface MonitoringStation {
  id: string;
  name_en: string;
  name_hi: string;
  lat: number;
  lon: number;
  station_name: string;
  openaq_location_id: string;
  elevation_m: number;
  current_obs_pm25: number;
  obs_timestamp: string;
  is_stale: boolean;
  agency: 'DPCC' | 'CPCB';
}

export interface SchoolPeriodVerdict {
  period_id: string;
  time: string;
  name_en: string;
  name_hi: string;
  forecast_pm25: number;
  verdict: 'go' | 'limit' | 'skip';
  category: string;
}

export interface SchoolAssessment {
  school: School;
  current_pm25: number;
  forecast_pm25: number;
  provenance_type: 'nearby_station' | 'model_estimate';
  nearest_station_name: string;
  station_distance_km: number;
  periods: SchoolPeriodVerdict[];
  recommendation_en: string;
  recommendation_hi: string;
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface AdvisoryItem {
  id: string;
  priority: 'high' | 'medium' | 'low' | 'warning';
  scope: 'regional' | 'school' | 'station' | 'hotspot';
  title_en: string;
  title_hi: string;
  desc_en: string;
  desc_hi: string;
  recommendation_en: string;
  recommendation_hi: string;
  timestamp: string;
  pm25?: number;
  forecast_horizon?: string;
}
