const INCIDENT_TYPE_ALIASES = new Map([
  ['FLOOD', 'FLOOD'],
  ['FIRE', 'FIRE'],
  ['LANDSLIDE', 'LANDSLIDE'],
  ['LAND_SLIDE', 'LANDSLIDE'],
  ['EARTHQUAKE', 'EARTHQUAKE'],
  ['MEDICAL', 'MEDICAL'],
  ['MEDICAL_EMERGENCY', 'MEDICAL'],
  ['LOCALIZED_ACCIDENT', 'LOCALIZED_ACCIDENT'],
  ['ACCIDENT', 'LOCALIZED_ACCIDENT'],
  ['ROAD_ACCIDENT', 'LOCALIZED_ACCIDENT'],
  ['TRAFFIC_ACCIDENT', 'LOCALIZED_ACCIDENT'],
  ['OTHER', 'OTHER']
]);

function normalizeIncidentType(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const key = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return INCIDENT_TYPE_ALIASES.get(key) || null;
}

function categoryFromDescription(description) {
  if (typeof description !== 'string') return null;
  const match = description.match(/^\s*Category\s*:\s*(.*?)\s*$/im);
  return match && match[1] ? match[1].trim() : null;
}

function categoryFromTitle(title) {
  if (typeof title !== 'string') return null;
  const match = title.match(/^\s*SOS\s*:\s*(.+?)\s+Emergency\s*$/i);
  return match && match[1] ? match[1].trim() : null;
}

function victimCountFromDescription(description) {
  if (typeof description !== 'string') return null;
  const match = description.match(/^\s*(?:People needing help|Victim count)\s*:\s*(\d+)\s*$/im);
  if (!match) return null;

  const count = Number(match[1]);
  return Number.isSafeInteger(count) && count <= 2_147_483_647 ? count : null;
}

function validVictimCount(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 2_147_483_647
    ? value
    : null;
}

function buildSOSIncidentFields({ type, category, title, description, victimCount }) {
  const explicitType = normalizeIncidentType(type) || normalizeIncidentType(category);
  const describedCategory = categoryFromDescription(description);
  const titledCategory = categoryFromTitle(title);
  const inferredType = normalizeIncidentType(describedCategory) || normalizeIncidentType(titledCategory);
  const victimCountValue = validVictimCount(victimCount);
  const describedVictimCount = victimCountFromDescription(description);

  return {
    type: explicitType || inferredType || 'OTHER',
    victimCount: victimCountValue ?? describedVictimCount
  };
}

function resolveHistoricalIncidentFields(incident) {
  const storedType = typeof incident.type === 'string' ? incident.type.trim() : '';
  const normalizedStoredType = normalizeIncidentType(storedType);
  const descriptionCategory = categoryFromDescription(incident.description);
  const titleCategory = categoryFromTitle(incident.title);
  const inferredCategory = descriptionCategory || titleCategory;
  const inferredType = normalizeIncidentType(inferredCategory);

  const useDescriptionType = (!storedType || normalizedStoredType === 'OTHER') && inferredCategory;
  const type = useDescriptionType
    ? inferredType || inferredCategory.toUpperCase()
    : normalizedStoredType || storedType.toUpperCase() || 'OTHER';

  const structuredVictimCount = validVictimCount(incident.victimCount);
  const victimCountFromText = victimCountFromDescription(incident.description);

  return {
    type,
    victimCount: structuredVictimCount ?? victimCountFromText,
    typeInferredFromDescription: Boolean(useDescriptionType && descriptionCategory),
    typeInferredFromTitle: Boolean(useDescriptionType && !descriptionCategory && titleCategory),
    victimCountInferredFromDescription: structuredVictimCount === null && victimCountFromText !== null
  };
}

module.exports = {
  buildSOSIncidentFields,
  resolveHistoricalIncidentFields
};
