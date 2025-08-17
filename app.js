
const SOCRATA_ENDPOINT = 'https://data.seattle.gov/resource/tazs-3rd5.json'
// future endpoint: 'https://data.seattle.gov/api/v3/tazs-3rd5/query.json'


// Documentation: https://dev.socrata.com/foundry/data.seattle.gov/tazs-3rd5

let map;
let radius = 500; // feet radius to search
let relativeYears = 3; // years to search back
let markers = [];
let bounds = [];
let markerGroup;
let mapClickDisabled = false;

function onMapClick(e) {
  // Prevent clicking too many times and doing lots of requests.
  if (!mapClickDisabled) {
    querySeattleSocrata(e.latlng.lat, e.latlng.lng);
    mapClickDisabled = true;
    setTimeout(function () {
      mapClickDisabled = false;
    }, 1000)
  }
}

/* Example response values for event:

"report_number": "2019-009955",
"report_date_time": "2019-01-08T10:46:00.000",
"offense_id": "7663504285",
"offense_date": "2018-12-10T10:00:00.000",
"nibrs_group_a_b": "A",
"nibrs_crime_against_category": "PROPERTY",
"offense_sub_category": "EXTORTION/FRAUD/FORGERY/BRIBERY (INCLUDES BAD CHECKS)",
"shooting_type_group": "-",
"block_address": "55XX BLOCK OF 24TH AVE NW",
"latitude": "47.669068",
"longitude": "-122.387582",
"beat": "B1",
"precinct": "North",
"sector": "B",
"neighborhood": "BALLARD SOUTH",
"reporting_area": "6451",
"offense_category": "ALL OTHER",
"nibrs_offense_code_description": "False Pretenses/Swindle/Confidence Game",
"nibrs_offense_code": "26A"
 */

function querySeattleSocrata(lat, lng) {
  // Build boundaries of query
  const max = addToLatLng(lat, lng, radius, radius);
  const min = addToLatLng(lat, lng, -radius, -radius);

  const select = '$select=offense_date,nibrs_offense_code_description,latitude,longitude,report_number,block_address'
  const fixed_timestamp_value = moment().subtract(relativeYears, 'years').format('YYYY-MM-DDTHH:mm:ss.SSS');
  const where = `$where=latitude!='REDACTED' AND latitude::number <= ${max.lat} ` +
    `AND longitude::number <= ${max.lng} AND latitude::number >= ${min.lat} AND longitude::number >= ${min.lng} ` +
    `AND offense_date >= '${fixed_timestamp_value}'`;
  const order = '$order=offense_date DESC'

  const query = SOCRATA_ENDPOINT + '?' + select + '&' + where + '&' + order;

  console.log(query);
  console.log(encodeURI(query));
  fetch(encodeURI(query))
    .then(res => res.json())
    .then((events) => {
      const eventsMap = processEvents(events);
      makeMarkers(eventsMap);
      makeBounds(min, max);
    })
    .catch(err => { throw err });
}

// Returns a map of event report_numbers to the events.
function processEvents(events) {
  // Stores all events groupd by the report_number
  let eventMap = {};
  events.forEach(event => {
    if (eventMap[event.report_number]) {
      eventMap[event.report_number].push(event);
    } else {
      eventMap[event.report_number] = [event];
    }
  });
  return eventMap;
}

function makeMarkers(eventMap) {
  console.log(eventMap);
  markers.forEach(marker => map.removeLayer(marker));
  markers = [];

  if (markerGroup) {
    map.removeLayer(markerGroup);
  }
  markerGroup = L.markerClusterGroup({
    spiderfyDistanceMultiplier: 1.5
  });

  for (const eventReportNumber in eventMap) {
    let newMarker;

    // Always grab first event, to limit duplication of reports with same report number.
    const event = eventMap[eventReportNumber][0];
    let eventDateTime = moment(event.offense_date).format("lll");
    let title = event.nibrs_offense_code_description + ' - ' + eventDateTime;
    newMarker = L.marker([event.latitude, event.longitude], { title: title });
    newMarker.bindPopup(`<b alt>${event.nibrs_offense_code_description}</b><br>Time: ${eventDateTime}<br>Report Number: ${event.report_number}<br>Block: ${event.block_address}`)

    if (newMarker) {
      markers.push(newMarker);
      markerGroup.addLayer(newMarker);
    }
  }

  map.addLayer(markerGroup);
}

function makeBounds(minLatLng, maxLatLng) {
  bounds.forEach(bound => map.removeLayer(bound));
  bounds = [];

  let newBound = L.rectangle([minLatLng, maxLatLng], { color: "#ff6e6e", weight: 3, fillOpacity: 0.15, interactive: true });
  bounds.push(newBound);
  map.flyToBounds(newBound, { padding: [48, 48], duration: 0.5 });
  newBound.addTo(map)
}


function init() {
  map = L.map('mapid').setView([47.6072, -122.3321], 12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  // Map handlers
  map.on('click', onMapClick);
}

// Returns the distance between two lat lng points in feet.
function distance(lat1, lng1, lat2, lng2) {
  if ((lat1 === lat2) && (lng1 === lng2)) {
    return 0;
  }
  else {
    const radlat1 = Math.PI * lat1 / 180;
    const radlat2 = Math.PI * lat2 / 180;
    const theta = lng1 - lng2;
    const radtheta = Math.PI * theta / 180;
    let dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
    if (dist > 1) {
      dist = 1;
    }
    dist = Math.acos(dist);
    dist = dist * 180 / Math.PI;
    dist = dist * 60 * 1.1515 * 5280;
    return dist;
  }
}

// https://stackoverflow.com/questions/7477003/calculating-new-longitude-latitude-from-old-n-meters
function addToLatLng(lat, lng, feetY = 0, feetX = 0) {
  const earth = 6378.137; // radius of the earth in kilometers
  const meterInDegree = (1 / ((2 * Math.PI / 360) * earth)) / 1000;  // 1 meter in degree

  const metersY = feetY / 3.2808;
  const metersX = feetX / 3.2808;

  const newLat = lat + (metersY * meterInDegree);
  const newLng = lng + (metersX * meterInDegree) / Math.cos(lat * (Math.PI / 180));
  return L.latLng(newLat, newLng);
}

function getRandomString(arr) {
  const randomIndex = Math.floor(Math.random() * arr.length);
  return arr[randomIndex];
}

window.onload = function () {
  init();
};