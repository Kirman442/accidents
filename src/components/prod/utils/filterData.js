
export const filterFields = ['uland','uwochentag','ukategorie','ist_rad','ist_pkw','ist_fuss'];
export function matchesFilters(properties, filters) {
  return filterFields.every(field => filters[field] == null ||
    (properties[field] != null && properties[field] !== '' && Number(properties[field]) === Number(filters[field])));
}
export function filterCoordinates(features, filters) {
  return features.filter(f => matchesFilters(f.properties, filters))
    .map(f => ({latitude:f.latitude, longitude:f.longitude}));
}
