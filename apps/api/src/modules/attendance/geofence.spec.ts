import { haversineMeters } from './attendance.service';

describe('haversine geofence distance', () => {
  it('returns zero at the same point', () => {
    expect(haversineMeters(21.0285, 105.8542, 21.0285, 105.8542)).toBe(0);
  });

  it('returns a meter-scale distance for nearby GPS points', () => {
    const distance = haversineMeters(21.0285, 105.8542, 21.0290, 105.8542);
    expect(distance).toBeGreaterThan(50);
    expect(distance).toBeLessThan(60);
  });
});
