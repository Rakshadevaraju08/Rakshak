import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIncident } from '../services/incidentService';
import {
  filterIncidentReports,
  getIncidentStatusCounts,
  getIncidentTrend,
  getIncidentTrendForRange,
} from './reporting';

function incident(id: string, type: string, status: string, createdAt: string) {
  const result = normalizeIncident({ id, title: id, type, status, createdAt });
  assert.ok(result);
  return result;
}

test('report filters combine status, category, and inclusive date bounds', () => {
  const reports = [
    incident('first', 'FLOOD', 'ACTIVE', new Date(2026, 5, 10, 0).toISOString()),
    incident('last', 'FLOOD', 'ACTIVE', new Date(2026, 5, 10, 23, 59, 59, 999).toISOString()),
    incident('other-status', 'FLOOD', 'RESOLVED', new Date(2026, 5, 10, 12).toISOString()),
    incident('other-type', 'FIRE', 'ACTIVE', new Date(2026, 5, 10, 12).toISOString()),
    incident('outside-range', 'FLOOD', 'ACTIVE', new Date(2026, 5, 11, 0).toISOString()),
  ];

  const result = filterIncidentReports(reports, {
    status: 'ACTIVE',
    category: 'FLOOD',
    startDate: '2026-06-10',
    endDate: '2026-06-10',
  });

  assert.deepEqual(result.map(report => report.id), ['first', 'last']);
});

test('status summaries count only returned incident records', () => {
  const counts = getIncidentStatusCounts([
    incident('new-1', 'FLOOD', 'NEW', '2026-06-10T00:00:00.000Z'),
    incident('new-2', 'FIRE', 'NEW', '2026-06-10T01:00:00.000Z'),
    incident('active', 'OTHER', 'ACTIVE', '2026-06-10T02:00:00.000Z'),
  ]);

  assert.deepEqual([...counts.entries()], [['NEW', 2], ['ACTIVE', 1]]);
});

test('seven-day trend uses created timestamps and includes zero-count days', () => {
  const now = new Date(2026, 5, 10, 12);
  const reports = [
    incident('today-1', 'FLOOD', 'NEW', new Date(2026, 5, 10, 8).toISOString()),
    incident('today-2', 'FIRE', 'NEW', new Date(2026, 5, 10, 9).toISOString()),
    incident('old', 'OTHER', 'ACTIVE', new Date(2026, 5, 2, 9).toISOString()),
  ];

  const trend = getIncidentTrend(reports, now);

  assert.equal(trend.length, 7);
  assert.equal(trend[0].date, '2026-06-04');
  assert.equal(trend[6].date, '2026-06-10');
  assert.deepEqual(trend.map(point => point.count), [0, 0, 0, 0, 0, 0, 2]);
});

test('custom trend ranges include both dates and count actual incident timestamps', () => {
  const reports = [
    incident('start', 'FLOOD', 'NEW', new Date(2026, 5, 1, 0).toISOString()),
    incident('middle', 'FIRE', 'ACTIVE', new Date(2026, 5, 2, 12).toISOString()),
    incident('end', 'OTHER', 'RESOLVED', new Date(2026, 5, 3, 23, 59).toISOString()),
    incident('outside', 'OTHER', 'NEW', new Date(2026, 5, 4, 0).toISOString()),
  ];

  const trend = getIncidentTrendForRange(reports, '2026-06-01', '2026-06-03');

  assert.deepEqual(trend.map(point => point.date), ['2026-06-01', '2026-06-02', '2026-06-03']);
  assert.deepEqual(trend.map(point => point.count), [1, 1, 1]);
  assert.ok(trend[0].label.includes('Jun') && trend[0].label.includes('1'));
});

test('custom trend rejects incomplete or reversed date ranges', () => {
  const reports = [incident('one', 'FLOOD', 'NEW', '2026-06-02T12:00:00.000Z')];

  assert.deepEqual(getIncidentTrendForRange(reports, '', '2026-06-03'), []);
  assert.deepEqual(getIncidentTrendForRange(reports, '2026-06-03', '2026-06-01'), []);
});
