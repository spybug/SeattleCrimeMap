/**
 * Seattle Crime Map
 * Client-side static map application using Seattle SPD Public Socrata API and OSM Nominatim.
 */

// Configuration constants
const SOCRATA_ENDPOINT = 'https://data.seattle.gov/resource/tazs-3rd5.json';
const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const RADIUS_FEET = 500;
const RELATIVE_YEARS = 3;

// Application state
let map;
let allCrimes = [];
let blockGroups = {}; // Keyed by block address
let blockMarkers = [];
let categorySubMarkers = [];
let activeBlockMarker = null;
let activeCategorySubMarker = null;
let searchTargetMarker = null;
let searchBoundsPolygon = null;
let currentFilter = { type: 'none', blockAddress: null, category: null };
let currentAreaLocationName = '';
let mapClickDisabled = false;

// Seattle city limits polygon (ring of [lng, lat] pairs) — loaded from GeoJSON
let seattleLimitsRing = null;
let seattleLimitsLayer = null;

// Crime Category Definitions & Custom SVG Icons
const CRIME_CATEGORIES = {
  theft_from_vehicle: {
    key: 'theft_from_vehicle',
    label: 'Theft from Vehicle',
    color: '#fbbf24',
    bgClass: 'cat-theft_from_vehicle',
    svg: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H7.5a1 1 0 0 0-.8.4L4 11l-2.16.86a1 1 0 0 0-.84.99V16h3"/>
            <circle cx="6.5" cy="16.5" r="2.5"/>
            <circle cx="16.5" cy="16.5" r="2.5"/>
          </svg>`
  },
  burglary: {
    key: 'burglary',
    label: 'Burglary / Larceny / Trespass',
    color: '#f59e0b',
    bgClass: 'cat-burglary',
    svg: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <rect width="6" height="6" x="9" y="13" rx="1"/>
            <path d="M12 10v3"/>
          </svg>`
  },
  drug_narcotic: {
    key: 'drug_narcotic',
    label: 'Drug / Narcotic',
    color: '#c084fc',
    bgClass: 'cat-drug_narcotic',
    svg: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
            <path d="m8.5 8.5 7 7"/>
          </svg>`
  },
  extortion: {
    key: 'extortion',
    label: 'Extortion / Blackmail',
    color: '#fb7185',
    bgClass: 'cat-extortion',
    svg: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="14" x="3" y="5" rx="2"/>
            <polyline points="3 7 12 13 21 7"/>
            <circle cx="12" cy="14" r="2"/>
          </svg>`
  },
  arson: {
    key: 'arson',
    label: 'Arson',
    color: '#fb923c',
    bgClass: 'cat-arson',
    svg: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
          </svg>`
  },
  forgery: {
    key: 'forgery',
    label: 'Counterfeiting / Forgery',
    color: '#a78bfa',
    bgClass: 'cat-forgery',
    svg: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <path d="M9 15h6"/>
            <path d="m12 18 3-3"/>
          </svg>`
  },
  fraud: {
    key: 'fraud',
    label: 'Fraud / Confidence Game',
    color: '#38bdf8',
    bgClass: 'cat-fraud',
    svg: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <rect width="20" height="14" x="2" y="5" rx="2"/>
            <line x1="2" x2="22" y1="10" y2="10"/>
            <line x1="6" x2="10" y1="15" y2="15"/>
            <line x1="14" x2="18" y1="15" y2="15"/>
          </svg>`
  },
  weapon: {
    key: 'weapon',
    label: 'Weapon Violation',
    color: '#f87171',
    bgClass: 'cat-weapon',
    svg: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="22" y1="12" x2="18" y2="12"/>
            <line x1="6" y1="12" x2="2" y2="12"/>
            <line x1="12" y1="6" x2="12" y2="2"/>
            <line x1="12" y1="22" x2="12" y2="18"/>
          </svg>`
  },
  animal_cruelty: {
    key: 'animal_cruelty',
    label: 'Animal Cruelty',
    color: '#2dd4bf',
    bgClass: 'cat-animal_cruelty',
    svg: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="8" cy="7" r="2"/>
            <circle cx="16" cy="7" r="2"/>
            <circle cx="4" cy="11" r="2"/>
            <circle cx="20" cy="11" r="2"/>
            <path d="M12 11c-3 0-5 2.5-5 5.5 0 2 1.5 3.5 5 3.5s5-1.5 5-3.5c0-3-2-5.5-5-5.5z"/>
          </svg>`
  },
  obscene_material: {
    key: 'obscene_material',
    label: 'Porn / Obscene Material',
    color: '#e879f9',
    bgClass: 'cat-obscene_material',
    svg: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
            <line x1="2" y1="2" x2="22" y2="22"/>
          </svg>`
  },
  dui: {
    key: 'dui',
    label: 'DUI / Alcohol',
    color: '#fb923c',
    bgClass: 'cat-dui',
    svg: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="3"/>
            <line x1="12" y1="2" x2="12" y2="9"/>
            <line x1="4.93" y1="19.07" x2="9.88" y2="14.12"/>
            <line x1="19.07" y1="19.07" x2="14.12" y2="14.12"/>
          </svg>`
  },
  pocket_picking: {
    key: 'pocket_picking',
    label: 'Pocket-picking',
    color: '#86efac',
    bgClass: 'cat-pocket_picking',
    svg: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/>
            <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>
            <circle cx="18" cy="14" r="1"/>
          </svg>`
  },
  assault: {
    key: 'assault',
    label: 'Assault / Violent',
    color: '#f87171',
    bgClass: 'cat-assault',
    svg: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>`
  },
  other: {
    key: 'other',
    label: 'Other Offense',
    color: '#94a3b8',
    bgClass: 'cat-other',
    svg: `<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>`
  }
};

/**
 * Classify a crime event into one of our main crime categories.
 */
function categorizeCrime(desc = '', subCategory = '') {
  const text = (desc + ' ' + subCategory).toLowerCase();

  // 1. Theft from Vehicle / Car prowl
  if (text.includes('theft from motor vehicle') || text.includes('theft of motor vehicle') || 
      text.includes('motor vehicle theft') || text.includes('theft from vehicle') || text.includes('car prowl')) {
    return 'theft_from_vehicle';
  }

  // 2. Pocket-picking / Purse-snatching
  if (text.includes('pocket-picking') || text.includes('purse-snatching') || 
      text.includes('theft from person') || text.includes('pocket picking')) {
    return 'pocket_picking';
  }

  // 3. Extortion or Blackmail
  if (text.includes('extortion') || text.includes('blackmail')) {
    return 'extortion';
  }

  // 4. Counterfeiting or Forgery
  if (text.includes('counterfeit') || text.includes('forgery')) {
    return 'forgery';
  }

  // 5. Fraud
  if (text.includes('fraud') || text.includes('false pretenses') || text.includes('swindle') || 
      text.includes('confidence game') || text.includes('bad check') || text.includes('identity theft') || text.includes('wire fraud')) {
    return 'fraud';
  }

  // 6. Arson
  if (text.includes('arson')) {
    return 'arson';
  }

  // 7. Animal Cruelty
  if (text.includes('animal cruelty') || text.includes('animal')) {
    return 'animal_cruelty';
  }

  // 8. Porn or Obscene Material
  if (text.includes('porn') || text.includes('obscene') || text.includes('obscenity')) {
    return 'obscene_material';
  }

  // 9. Weapon violations (match weapon)
  if (text.includes('weapon')) {
    return 'weapon';
  }

  // 10. Drug or Narcotic
  if (text.includes('drug') || text.includes('narcotic')) {
    return 'drug_narcotic';
  }

  // 11. Driving Under Influence / Liquor
  if (text.includes('driving under the influence') || text.includes('dui') || text.includes('dwi') || text.includes('liquor')) {
    return 'dui';
  }

  // 12. Burglary, Larceny, Stolen, Trespass
  // ("larceny" or "stolen" anything with "trespass" treated same as burglary)
  if (text.includes('burglary') || text.includes('breaking & entering') || text.includes('breaking and entering') || 
      text.includes('trespass') || text.includes('larceny') || text.includes('stolen')) {
    return 'burglary';
  }

  // 13. Assault / Violent
  if (text.includes('assault') || text.includes('homicide') || text.includes('murder') || 
      text.includes('robbery') || text.includes('battery') || text.includes('intimidation')) {
    return 'assault';
  }

  return 'other';
}

/**
 * Initialize application, Leaflet map, and UI handlers.
 */
function init() {
  initMap();
  initSearch();
  initUIHandlers();
  showLoadingStatus(false);
}

/**
 * Initialize Leaflet map with CartoDB Dark Matter tiles.
 */
function initMap() {
  // Center on Downtown Seattle by default
  map = L.map('mapid', {
    zoomControl: false,
    tap: false
  }).setView([47.6072, -122.3321], 10);

  // Reposition zoom controls to bottom-right
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Initialize 100% free tiles with zero API keys or rate limits
  initMapTiles();

  // Load and draw the Seattle city limits boundary
  loadSeattleCityLimits();

  // Map click handler to trigger Socrata query
  map.on('click', onMapClick);
}

/**
 * Load Seattle city limits GeoJSON, draw a bold green boundary on the map,
 * and store the polygon ring for point-in-polygon checks.
 */
function loadSeattleCityLimits() {
  fetch('./seattle_city_limits.geojson')
    .then(res => res.json())
    .then(geojson => {
      // Extract the outer ring coordinates ([lng, lat] pairs) for PIP checks
      const feature = geojson.features && geojson.features[0];
      if (feature && feature.geometry && feature.geometry.type === 'Polygon') {
        seattleLimitsRing = feature.geometry.coordinates[0]; // [[lng, lat], ...]
      }

      // Draw the boundary on the map as a bold permanent green polyline/polygon
      seattleLimitsLayer = L.geoJSON(geojson, {
        style: {
          color: '#22c55e',
          weight: 3,
          opacity: 0.85,
          fillColor: 'transparent',
          fillOpacity: 0,
          interactive: false
        }
      });
      seattleLimitsLayer.addTo(map);
      seattleLimitsLayer.bindTooltip('Seattle City Limits', {
        permanent: false,
        sticky: true,
        className: 'seattle-limits-tooltip',
        direction: 'top'
      });
    })
    .catch(err => {
      console.warn('Could not load Seattle city limits boundary:', err);
    });
}

/**
 * Ray-casting point-in-polygon check.
 * ring: array of [lng, lat] pairs (the outer ring of the city polygon)
 * lat, lng: the point to test
 * Returns true if the point is inside the polygon.
 */
function isPointInSeattle(lat, lng) {
  if (!seattleLimitsRing) return true; // If boundary not loaded, allow all points
  const ring = seattleLimitsRing;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1]; // lng, lat
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > lat) !== (yj > lat)) &&
                      (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Show a brief warning when the user clicks or searches outside Seattle city limits.
 */
function showOutsideLimitsWarning() {
  // Reuse the map status overlay briefly
  const overlay = document.getElementById('map-status-overlay');
  const text = document.getElementById('map-status-text');
  if (!overlay || !text) return;
  text.textContent = '⚠️ That location is outside Seattle city limits. Please select a point within Seattle.';
  overlay.hidden = false;
  setTimeout(() => { overlay.hidden = true; }, 5000);
}

/**
 * Initialize map basemap using OpenFreeMap (100% free, no API key, no quotas or limits)
 * with a fallback to Esri Dark Gray canvas raster tiles if WebGL is unavailable.
 */
function initMapTiles() {
  let loaded = false;

  try {
    if (typeof L.maplibreGL === 'function' && window.WebGLRenderingContext) {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        L.maplibreGL({
          style: 'https://tiles.openfreemap.org/styles/dark'
        }).addTo(map);
        loaded = true;
      }
    }
  } catch (err) {
    console.warn('MapLibre GL not supported, falling back to raster tiles:', err);
  }

  // Fallback if MapLibre GL is unavailable or WebGL disabled
  if (!loaded) {
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
    }).addTo(map);
  }
}

function onMapClick(e) {
  if (mapClickDisabled) return;

  // Reject clicks outside Seattle city limits
  if (seattleLimitsRing && !isPointInSeattle(e.latlng.lat, e.latlng.lng)) {
    showOutsideLimitsWarning();
    return;
  }

  hideMapHint();
  closeSearchDropdown();
  querySeattleSocrata(e.latlng.lat, e.latlng.lng);

  mapClickDisabled = true;
  setTimeout(() => { mapClickDisabled = false; }, 800);
}

function hideMapHint() {
  const hint = document.getElementById('map-hint');
  if (hint) {
    hint.classList.add('is-hidden');
  }
}

/**
 * Query Seattle SPD Socrata API for crimes in a 500ft radius over past 3 years.
 */
function querySeattleSocrata(lat, lng, addressLabel = null) {
  showLoadingStatus(true, 'Querying Seattle Police records...');

  const max = addToLatLng(lat, lng, RADIUS_FEET, RADIUS_FEET);
  const min = addToLatLng(lat, lng, -RADIUS_FEET, -RADIUS_FEET);

  const select = '$select=offense_date,nibrs_offense_code_description,offense_sub_category,latitude,longitude,report_number,block_address';
  const fixedTimestamp = moment().subtract(RELATIVE_YEARS, 'years').format('YYYY-MM-DDTHH:mm:ss.SSS');
  const where = `$where=latitude!='REDACTED' AND latitude::number <= ${max.lat} ` +
    `AND longitude::number <= ${max.lng} AND latitude::number >= ${min.lat} AND longitude::number >= ${min.lng} ` +
    `AND offense_date >= '${fixedTimestamp}'`;
  const order = '$order=offense_date DESC';
  const limit = '$limit=2000';

  const queryUrl = `${SOCRATA_ENDPOINT}?${select}&${where}&${order}&${limit}`;

  fetch(encodeURI(queryUrl))
    .then(res => {
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return res.json();
    })
    .then(events => {
      showLoadingStatus(false);
      handleCrimeDataLoaded(events, min, max, lat, lng, addressLabel);
    })
    .catch(err => {
      showLoadingStatus(false);
      console.error('Failed to load crime data:', err);
      alert('Could not load crime data from Seattle Open Data at this moment. Please try again.');
    });
}

/**
 * Process received crime data, group by block, render markers, and populate sidebar.
 */
function handleCrimeDataLoaded(events, minLatLng, maxLatLng, centerLat, centerLng, addressLabel) {
  // Deduplicate and decorate events with category
  allCrimes = events.map(event => {
    const categoryKey = categorizeCrime(event.nibrs_offense_code_description, event.offense_sub_category);
    return {
      ...event,
      categoryKey,
      categoryMeta: CRIME_CATEGORIES[categoryKey],
      latitude: parseFloat(event.latitude),
      longitude: parseFloat(event.longitude)
    };
  });

  // Group events by block_address (or coordinates if missing)
  blockGroups = {};
  allCrimes.forEach(crime => {
    const key = crime.block_address || `${crime.latitude.toFixed(4)},${crime.longitude.toFixed(4)}`;
    if (!blockGroups[key]) {
      blockGroups[key] = {
        blockAddress: crime.block_address || 'Unspecified Block',
        lat: crime.latitude,
        lng: crime.longitude,
        crimes: [],
        categories: {}
      };
    }
    blockGroups[key].crimes.push(crime);

    const cat = crime.categoryKey;
    if (!blockGroups[key].categories[cat]) {
      blockGroups[key].categories[cat] = [];
    }
    blockGroups[key].categories[cat].push(crime);
  });

  // Determine location label for the neighborhood view
  if (addressLabel) {
    currentAreaLocationName = addressLabel;
  } else if (events && events.length > 0) {
    // Find the most frequent block address in this 500ft radius
    const counts = {};
    let topBlock = events[0].block_address || 'Seattle Area';
    let maxC = 0;
    events.forEach(e => {
      if (e.block_address) {
        counts[e.block_address] = (counts[e.block_address] || 0) + 1;
        if (counts[e.block_address] > maxC) {
          maxC = counts[e.block_address];
          topBlock = e.block_address;
        }
      }
    });
    currentAreaLocationName = topBlock;
  } else {
    currentAreaLocationName = 'Selected Map Area';
  }

  const locationSub = document.getElementById('sidebar-location-sub');
  if (locationSub) {
    locationSub.textContent = `Near ${currentAreaLocationName}`;
    locationSub.hidden = false;
  }

  // Draw 500ft search bounding box & fly map to area
  renderSearchArea(minLatLng, maxLatLng);

  // Render block-level markers on the map
  renderBlockMarkers();

  // Reset active filters
  resetFilter();
}

/**
 * Draw search bounding box polygon with flyToBounds animation.
 */
function renderSearchArea(minLatLng, maxLatLng) {
  if (searchBoundsPolygon) {
    map.removeLayer(searchBoundsPolygon);
  }

  searchBoundsPolygon = L.rectangle([minLatLng, maxLatLng], {
    color: '#86efac',
    weight: 2,
    dashArray: '4, 4',
    fillColor: '#173327',
    fillOpacity: 0.15,
    interactive: false
  });

  searchBoundsPolygon.addTo(map);
  map.flyToBounds(searchBoundsPolygon, {
    padding: [36, 36],
    duration: 0.8
  });
}

/**
 * Render single aggregated marker per block.
 */
function renderBlockMarkers() {
  clearBlockMarkers();
  clearCategorySubMarkers();

  Object.values(blockGroups).forEach(block => {
    const crimeCount = block.crimes.length;
    let tierClass = 'tier-low';
    let size = 32;

    if (crimeCount >= 10) {
      tierClass = 'tier-high';
      size = 38;
    } else if (crimeCount >= 4) {
      tierClass = 'tier-med';
      size = 34;
    }

    const html = `<div class="block-marker ${tierClass}" style="width: ${size}px; height: ${size}px;">
                    <span>${crimeCount}</span>
                  </div>`;

    const icon = L.divIcon({
      className: 'block-div-icon',
      html: html,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });

    const marker = L.marker([block.lat, block.lng], { icon, title: block.blockAddress });
    
    // Add tooltip showing block name and total count
    marker.bindTooltip(`
      <div style="font-weight: 600; font-size: 13px;">${block.blockAddress}</div>
      <div style="color: #a3baa9; font-size: 11px;">${crimeCount} total crime${crimeCount === 1 ? '' : 's'} reported</div>
    `, { direction: 'top', offset: [0, -size / 2], className: 'custom-leaflet-tooltip' });

    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      onBlockMarkerClick(block, marker);
    });

    marker.addTo(map);
    blockMarkers.push(marker);
    block.marker = marker;
  });
}

/**
 * Handle clicking on a block marker:
 * - Highlights marker
 * - Expands category sub-markers in an orbit
 * - Filters sidebar crime list to this block
 */
function onBlockMarkerClick(block, marker) {
  // If in category view and clicking the central block marker, return to the full block view
  if (currentFilter.type === 'category' && currentFilter.blockAddress === block.blockAddress) {
    // Deselect category sub-markers
    categorySubMarkers.forEach(m => {
      const el = m.getElement() ? m.getElement().querySelector('.category-sub-marker') : null;
      if (el) el.classList.remove('is-selected');
    });

    setFilter({
      type: 'block',
      blockAddress: block.blockAddress,
      category: null,
      crimes: block.crimes,
      label: `${block.blockAddress} (${block.crimes.length})`,
      iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2"/>
                  <path d="M3 9h18"/>
                  <path d="M9 21V9"/>
                </svg>`
    });
    return;
  }

  // Clear previous sub-markers and highlight
  clearCategorySubMarkers();
  if (activeBlockMarker && activeBlockMarker.getElement()) {
    const el = activeBlockMarker.getElement().querySelector('.block-marker');
    if (el) el.classList.remove('is-active');
  }

  // Set active marker style
  activeBlockMarker = marker;
  const markerEl = marker.getElement() ? marker.getElement().querySelector('.block-marker') : null;
  if (markerEl) markerEl.classList.add('is-active');

  // Center slightly on block
  map.panTo([block.lat, block.lng], { animate: true, duration: 0.4 });

  // Generate category sub-markers in an orbit around the block
  spawnCategorySubMarkers(block);

  // Filter crime list to this block
  setFilter({
    type: 'block',
    blockAddress: block.blockAddress,
    category: null,
    crimes: block.crimes,
    label: `${block.blockAddress} (${block.crimes.length})`,
    iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2"/>
                <path d="M3 9h18"/>
                <path d="M9 21V9"/>
              </svg>`
  });
}

/**
 * Spawns category sub-markers in a radial orbit around the clicked block.
 */
function spawnCategorySubMarkers(block) {
  clearCategorySubMarkers();

  const categoriesPresent = Object.keys(block.categories);
  const count = categoriesPresent.length;
  if (count <= 1 && categoriesPresent[0] === 'other') {
    return;
  }

  // Radius in feet for geographical orbit
  const orbitRadiusFeet = 65;

  categoriesPresent.forEach((catKey, index) => {
    const catMeta = CRIME_CATEGORIES[catKey] || CRIME_CATEGORIES.other;
    const catCrimes = block.categories[catKey];
    const catCount = catCrimes.length;

    // Angle evenly spaced around circle
    const angle = (index / count) * 2 * Math.PI - Math.PI / 2;
    const subLatLng = addToLatLng(
      block.lat,
      block.lng,
      Math.sin(angle) * orbitRadiusFeet,
      Math.cos(angle) * orbitRadiusFeet
    );

    const subHtml = `
      <div class="category-sub-marker ${catMeta.bgClass}" title="${catMeta.label}: ${catCount}">
        <span class="sub-marker-icon">${catMeta.svg}</span>
        <span class="sub-marker-count">${catCount}</span>
      </div>`;

    const subIcon = L.divIcon({
      className: 'cat-sub-div-icon',
      html: subHtml,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const subMarker = L.marker(subLatLng, { icon: subIcon, zIndexOffset: 500 });
    
    subMarker.bindTooltip(`
      <div style="font-weight: 600; font-size: 12px; color: ${catMeta.color}">${catMeta.label}</div>
      <div style="color: #a3baa9; font-size: 11px;">${catCount} crime${catCount === 1 ? '' : 's'} on this block</div>
    `, { direction: 'top', offset: [0, -16] });

    subMarker.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      onCategorySubMarkerClick(block, catKey, catCrimes, subMarker);
    });

    subMarker.addTo(map);
    categorySubMarkers.push(subMarker);
  });
}

/**
 * Handle clicking on a category sub-marker:
 * Filters list to that specific category within the block.
 */
function onCategorySubMarkerClick(block, catKey, catCrimes, subMarker) {
  // Highlight clicked sub-marker
  categorySubMarkers.forEach(m => {
    const el = m.getElement() ? m.getElement().querySelector('.category-sub-marker') : null;
    if (el) el.classList.remove('is-selected');
  });

  const activeEl = subMarker.getElement() ? subMarker.getElement().querySelector('.category-sub-marker') : null;
  if (activeEl) activeEl.classList.add('is-selected');

  const catMeta = CRIME_CATEGORIES[catKey];

  setFilter({
    type: 'category',
    blockAddress: block.blockAddress,
    category: catKey,
    crimes: catCrimes,
    label: `${catMeta.label} · ${block.blockAddress} (${catCrimes.length})`,
    iconSvg: catMeta.svg
  });
}

/**
 * Clear existing block markers.
 */
function clearBlockMarkers() {
  blockMarkers.forEach(m => map.removeLayer(m));
  blockMarkers = [];
  activeBlockMarker = null;
}
/**
 * Clear category orbit sub-markers.
 */
function clearCategorySubMarkers() {
  categorySubMarkers.forEach(m => map.removeLayer(m));
  categorySubMarkers = [];
  activeCategorySubMarker = null;
}

/**
 * Highlight the block marker that matches the given blockAddress (from a card click in area view).
 * Removes any previous card-driven highlight, adds a pulsing ring to the matching marker.
 */
function highlightBlockMarker(blockAddress) {
  blockMarkers.forEach(m => {
    const el = m.getElement() ? m.getElement().querySelector('.block-marker') : null;
    if (el) el.classList.remove('card-highlight');
  });

  // Find the marker whose block address matches
  const block = blockGroups[blockAddress];
  if (block && block.marker) {
    const el = block.marker.getElement() ? block.marker.getElement().querySelector('.block-marker') : null;
    if (el) el.classList.add('card-highlight');
  }
}

/**
 * Highlight the category sub-marker that matches the given catKey (from a card click in block/category view).
 */
function highlightCategorySubMarker(catKey) {
  categorySubMarkers.forEach(m => {
    const el = m.getElement() ? m.getElement().querySelector('.category-sub-marker') : null;
    if (el) el.classList.remove('card-highlight');
  });

  // Find the sub-marker for this category by inspecting its element's class list
  categorySubMarkers.forEach(m => {
    const el = m.getElement() ? m.getElement().querySelector('.category-sub-marker') : null;
    if (el && el.classList.contains(`cat-${catKey}`)) {
      el.classList.add('card-highlight');
    }
  });
}

/**
 * Set active crime filter and update sidebar view & explicit back buttons.
 */
function setFilter(filter) {
  currentFilter = filter;
  const filterBar = document.getElementById('filter-bar');
  const filterLabel = document.getElementById('filter-label');
  const filterIcon = document.getElementById('filter-icon');
  const backToBlockBtn = document.getElementById('back-to-block-btn');
  const clearFilterBtn = document.getElementById('clear-filter-btn');

  if (filter.type === 'category') {
    filterBar.hidden = false;
    filterLabel.textContent = filter.label;
    filterIcon.innerHTML = filter.iconSvg;
    if (backToBlockBtn) backToBlockBtn.hidden = false;
    if (clearFilterBtn) clearFilterBtn.hidden = false;
    renderCrimeCards(filter.crimes);
  } else if (filter.type === 'block') {
    filterBar.hidden = false;
    filterLabel.textContent = filter.label;
    filterIcon.innerHTML = filter.iconSvg;
    if (backToBlockBtn) backToBlockBtn.hidden = true;
    if (clearFilterBtn) clearFilterBtn.hidden = false;
    renderCrimeCards(filter.crimes);
  } else {
    // Neighborhood view (all area crimes unfiltered)
    filterBar.hidden = true;
    if (backToBlockBtn) backToBlockBtn.hidden = true;
    if (clearFilterBtn) clearFilterBtn.hidden = true;
    renderCrimeCards(allCrimes);
  }
}

/**
 * Reset all filters to show all crimes in the bounding box (Neighborhood view).
 */
function resetFilter() {
  clearCategorySubMarkers();
  if (activeBlockMarker && activeBlockMarker.getElement()) {
    const el = activeBlockMarker.getElement().querySelector('.block-marker');
    if (el) el.classList.remove('is-active');
  }
  activeBlockMarker = null;
  // Also clear any card-driven highlights
  blockMarkers.forEach(m => {
    const el = m.getElement() ? m.getElement().querySelector('.block-marker') : null;
    if (el) el.classList.remove('card-highlight');
  });
  setFilter({ type: 'none', blockAddress: null, category: null, crimes: allCrimes });
}

/**
 * Render crime list cards in the sidebar.
 */
function renderCrimeCards(crimes) {
  const container = document.getElementById('crime-list');
  const totalBadge = document.getElementById('crime-total-badge');
  const mobileBadge = document.getElementById('mobile-badge');

  totalBadge.textContent = crimes.length;
  mobileBadge.textContent = crimes.length;

  if (!crimes || crimes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg viewBox="0 0 24 24" width="36" height="36" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 8v4"></path>
            <path d="M12 16h.01"></path>
          </svg>
        </div>
        <p class="empty-state-title">No crimes found</p>
        <p class="empty-state-text">No recorded crimes match the selected area or filter criteria.</p>
      </div>`;
    return;
  }

  const cardsHtml = crimes.map((crime, idx) => {
    const cat = crime.categoryMeta || CRIME_CATEGORIES.other;
    const formattedActualDate = moment(crime.offense_date).format('MMM D, YYYY');
    const formattedActualTime = moment(crime.offense_date).format('h:mm A');
    const relativeTime = moment(crime.offense_date).fromNow();

    return `
      <article class="crime-card" data-idx="${idx}" data-block="${escapeHtml(crime.block_address)}" data-cat="${escapeHtml(crime.categoryKey)}" data-lat="${crime.latitude}" data-lng="${crime.longitude}">
        <div class="card-icon-col">
          <div class="card-category-icon ${cat.bgClass}" title="${cat.label}">
            ${cat.svg}
          </div>
        </div>
        <div class="card-content-col">
          <h3 class="card-offense-title">${escapeHtml(crime.nibrs_offense_code_description)}</h3>
          <div class="card-block-address">
            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span>${escapeHtml(crime.block_address)}</span>
          </div>
          <div class="card-datetime-row">
            <span class="card-actual-datetime">${formattedActualDate} · ${formattedActualTime}</span>
            <span class="card-relative-time">(${relativeTime})</span>
          </div>
          <div class="card-meta-row">
            <span class="card-report-label">Police report number:</span>
            <span class="card-report-num" title="Selectable report number">#${escapeHtml(crime.report_number)}</span>
          </div>
        </div>
      </article>`;
  }).join('');

  container.innerHTML = cardsHtml;

  // Add click handlers on cards to highlight card and center map without changing filter state
  container.querySelectorAll('.crime-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Don't trigger if user is dragging/selecting text (e.g. copying report number)
      const sel = window.getSelection();
      if (sel && sel.toString().trim().length > 0) return;

      // Highlight this card in the sidebar
      container.querySelectorAll('.crime-card').forEach(c => c.classList.remove('is-selected'));
      card.classList.add('is-selected');

      // Center map smoothly on this crime's location
      const lat = parseFloat(card.getAttribute('data-lat'));
      const lng = parseFloat(card.getAttribute('data-lng'));
      if (!isNaN(lat) && !isNaN(lng)) {
        map.panTo([lat, lng], { animate: true, duration: 0.4 });
      }

      // Highlight the appropriate map marker based on current view
      const blockAddress = card.getAttribute('data-block');
      const catKey = card.getAttribute('data-cat');

      if (currentFilter.type === 'none') {
        // Full area view: highlight the block marker for this crime's block
        highlightBlockMarker(blockAddress);
      } else if (currentFilter.type === 'block') {
        // Block view with category sub-markers visible: highlight the category sub-marker
        highlightCategorySubMarker(catKey);
      } else if (currentFilter.type === 'category') {
        // Category-filtered view: highlight the category sub-marker
        highlightCategorySubMarker(catKey);
      }
    });
  });
}

/**
 * Address Search Bar & OpenStreetMap Nominatim Geocoding.
 */
function initSearch() {
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  const searchClearBtn = document.getElementById('search-clear-btn');
  const searchDropdown = document.getElementById('search-dropdown');

  searchInput.addEventListener('input', () => {
    searchClearBtn.hidden = searchInput.value.trim() === '';
  });

  searchClearBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchClearBtn.hidden = true;
    closeSearchDropdown();
    searchInput.focus();
  });

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (!query) return;

    performAddressSearch(query);
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!searchForm.contains(e.target)) {
      closeSearchDropdown();
    }
  });
}

/**
 * Perform geocoding search using free OpenStreetMap Nominatim API.
 */
function performAddressSearch(query) {
  const searchDropdown = document.getElementById('search-dropdown');
  const searchInput = document.getElementById('search-input');
  
  // Scoped to Seattle & King County
  // Seattle bounding box: min_lon: -122.4597, max_lat: 47.7341, max_lon: -122.2244, min_lat: 47.4955
  let queryWithContext = query;
  if (!query.toLowerCase().includes('seattle')) {
    queryWithContext += ', Seattle, WA';
  }

  showDropdownLoading('Searching addresses in Seattle...');

  const params = new URLSearchParams({
    format: 'json',
    q: queryWithContext,
    viewbox: '-122.459695,47.734145,-122.224433,47.495538',
    bounded: '0',
    countrycodes: 'us',
    limit: '6',
    addressdetails: '1'
  });

  fetch(`${NOMINATIM_ENDPOINT}?${params.toString()}`, {
    headers: {
      'Accept': 'application/json'
    }
  })
    .then(res => res.json())
    .then(results => {
      renderSearchDropdown(results, query);
    })
    .catch(err => {
      console.error('Nominatim search error:', err);
      searchDropdown.innerHTML = `
        <div class="dropdown-empty">Search service temporarily unavailable. Please try again or click the map directly.</div>`;
      searchDropdown.hidden = false;
    });
}

function showDropdownLoading(message) {
  const searchDropdown = document.getElementById('search-dropdown');
  searchDropdown.innerHTML = `<div class="dropdown-empty">${message}</div>`;
  searchDropdown.hidden = false;
}

function closeSearchDropdown() {
  const searchDropdown = document.getElementById('search-dropdown');
  if (searchDropdown) {
    searchDropdown.hidden = true;
    searchDropdown.innerHTML = '';
  }
}

/**
 * Render address choices in the search dropdown.
 */
function renderSearchDropdown(results, originalQuery) {
  const searchDropdown = document.getElementById('search-dropdown');
  const searchInput = document.getElementById('search-input');

  if (!results || results.length === 0) {
    searchDropdown.innerHTML = `
      <div class="dropdown-empty">No matching addresses found in the Seattle area for "<em>${escapeHtml(originalQuery)}</em>".</div>`;
    searchDropdown.hidden = false;
    return;
  }

  const itemsHtml = results.map(item => {
    const address = item.address || {};
    const mainTitle = item.name || address.road || address.neighbourhood || address.suburb || item.display_name.split(',')[0];
    const subTitle = item.display_name;

    return `
      <div class="dropdown-item" data-lat="${item.lat}" data-lon="${item.lon}" data-name="${escapeHtml(mainTitle)}">
        <span class="dropdown-item-icon">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </span>
        <div class="dropdown-item-content">
          <span class="dropdown-item-main">${escapeHtml(mainTitle)}</span>
          <span class="dropdown-item-sub">${escapeHtml(subTitle)}</span>
        </div>
      </div>`;
  }).join('');

  searchDropdown.innerHTML = itemsHtml;
  searchDropdown.hidden = false;

  // Add click event for each search result
  searchDropdown.querySelectorAll('.dropdown-item').forEach(el => {
    el.addEventListener('click', () => {
      const lat = parseFloat(el.getAttribute('data-lat'));
      const lon = parseFloat(el.getAttribute('data-lon'));
      const name = el.getAttribute('data-name');

      // Validate that result is within Seattle city limits
      if (seattleLimitsRing && !isPointInSeattle(lat, lon)) {
        closeSearchDropdown();
        searchInput.value = '';
        searchInput.placeholder = '⚠️ Location outside Seattle city limits';
        setTimeout(() => { searchInput.placeholder = 'Search Seattle address or neighborhood...'; }, 3500);
        return;
      }

      searchInput.value = name;
      closeSearchDropdown();
      hideMapHint();

      // Drop search location marker
      dropSearchPin(lat, lon, name);

      // Trigger crime query at coordinates
      querySeattleSocrata(lat, lon, name);
    });
  });
}

/**
 * Drop target search pin with pulse wave.
 */
function dropSearchPin(lat, lon, title) {
  if (searchTargetMarker) {
    map.removeLayer(searchTargetMarker);
  }

  const searchPinHtml = `
    <div class="search-target-pin" title="${escapeHtml(title)}">
      <div class="pin-pulse"></div>
      <div class="pin-center"></div>
    </div>`;

  const pinIcon = L.divIcon({
    className: 'search-pin-div-icon',
    html: searchPinHtml,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  searchTargetMarker = L.marker([lat, lon], { icon: pinIcon, zIndexOffset: 800 });
  searchTargetMarker.addTo(map);
}

/**
 * UI Controls: info modal, drawer expand/collapse, clear filter button, back button.
 */
function initUIHandlers() {
  // Back to block button (from category view)
  const backToBlockBtn = document.getElementById('back-to-block-btn');
  if (backToBlockBtn) {
    backToBlockBtn.addEventListener('click', () => {
      if (currentFilter.blockAddress && blockGroups[currentFilter.blockAddress]) {
        const block = blockGroups[currentFilter.blockAddress];
        // Deselect category sub-markers
        categorySubMarkers.forEach(m => {
          const el = m.getElement() ? m.getElement().querySelector('.category-sub-marker') : null;
          if (el) el.classList.remove('is-selected');
        });

        setFilter({
          type: 'block',
          blockAddress: block.blockAddress,
          category: null,
          crimes: block.crimes,
          label: `${block.blockAddress} (${block.crimes.length})`,
          iconSvg: `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                      <rect width="18" height="18" x="3" y="3" rx="2"/>
                      <path d="M3 9h18"/>
                      <path d="M9 21V9"/>
                    </svg>`
        });
      }
    });
  }

  // Clear filter button (Back to all area crimes)
  const clearFilterBtn = document.getElementById('clear-filter-btn');
  if (clearFilterBtn) {
    clearFilterBtn.addEventListener('click', resetFilter);
  }

  // Info modal dialog
  const infoBtn = document.getElementById('info-btn');
  const infoModal = document.getElementById('info-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');

  if (infoBtn && infoModal && closeModalBtn) {
    infoBtn.addEventListener('click', () => {
      infoModal.showModal();
    });

    closeModalBtn.addEventListener('click', () => {
      infoModal.close();
    });

    // Close when clicking modal backdrop
    infoModal.addEventListener('click', (e) => {
      const rect = infoModal.getBoundingClientRect();
      const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
                          rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
      if (!isInDialog) {
        infoModal.close();
      }
    });
  }

// Mobile Bottom Drawer Toggle
const mobileListToggle = document.getElementById('mobile-list-toggle');
const drawerHandle = document.getElementById('drawer-handle');
const sidebar = document.getElementById('sidebar');
const sidebarHeader = document.getElementById('sidebar-header');

// Toggle drawer
function toggleDrawer() {
  if (sidebar) {
    sidebar.classList.toggle('is-expanded');
  }
}

// Expand drawer
function expandDrawer() {
  if (sidebar) {
    sidebar.classList.add('is-expanded');
  }
}

// Collapse drawer
function collapseDrawer() {
  if (sidebar) {
    sidebar.classList.remove('is-expanded');
  }
}

// Plain list button in top right
if (mobileListToggle && sidebar) {
  mobileListToggle.addEventListener('click', toggleDrawer);
}

// Drawer handle interactions
if (drawerHandle && sidebar) {
  let startY = 0;
  let startX = 0;
  let isDragging = false;

  const swipeThreshold = 40; // Minimum swipe distance in pixels

  function pointerDown(e) {
    startY = e.clientY;
    startX = e.clientX;
    isDragging = true;

    drawerHandle.setPointerCapture(e.pointerId);
  }
  function pointerUp(e) {
    if (!isDragging) return;

    isDragging = false;

    const deltaY = e.clientY - startY;
    const deltaX = e.clientX - startX;

    // Only recognize primarily vertical gestures
    if (Math.abs(deltaY) > swipeThreshold &&
        Math.abs(deltaY) > Math.abs(deltaX)) {

      if (deltaY < 0) {
        // Swipe UP: Expand drawer
        expandDrawer();
      } else {
        // Swipe DOWN: Collapse drawer
        collapseDrawer();
      }
    } else if (
      Math.abs(deltaY) < 10 &&
      Math.abs(deltaX) < 10
    ) {
      // Regular tap: Toggle drawer
      toggleDrawer();
    }
  }
  drawerHandle.addEventListener('pointerdown', (e) => pointerDown(e));
  drawerHandle.addEventListener('pointerup', (e) => pointerUp(e));
  drawerHandle.addEventListener('pointercancel', () => {
    isDragging = false;
  });
  sidebarHeader.addEventListener('pointerdown', (e) => pointerDown(e));
  sidebarHeader.addEventListener('pointerup', (e) => pointerUp(e));
  sidebarHeader.addEventListener('pointercancel', () => {
    isDragging = false;
  });
}
}

/**
 * Loading status banner overlay.
 */
function showLoadingStatus(isLoading, message = 'Loading...') {
  const overlay = document.getElementById('map-status-overlay');
  const text = document.getElementById('map-status-text');
  if (!overlay || !text) return;

  if (isLoading) {
    text.textContent = message;
    overlay.hidden = false;
  } else {
    overlay.hidden = true;
  }
}

/**
 * Calculate new latitude and longitude from offsets in feet.
 */
function addToLatLng(lat, lng, feetY = 0, feetX = 0) {
  const earth = 6378.137; // radius of earth in km
  const meterInDegree = (1 / ((2 * Math.PI / 360) * earth)) / 1000;

  const metersY = feetY / 3.28084;
  const metersX = feetX / 3.28084;

  const newLat = lat + (metersY * meterInDegree);
  const newLng = lng + (metersX * meterInDegree) / Math.cos(lat * (Math.PI / 180));
  return L.latLng(newLat, newLng);
}

/**
 * Escape HTML utility.
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Kick off initialization on DOM ready
document.addEventListener('DOMContentLoaded', init);
