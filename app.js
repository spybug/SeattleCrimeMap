
const SOCRATA_ENDPOINT = 'https://data.seattle.gov/resource/tazs-3rd5.json'

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

/*
beat: "C2"
crime_against_category: "PROPERTY"
group_a_b: "A"
latitude: "47.635193980"
longitude: "-122.284032940"
mcpp: "MADISON PARK"
offense: "Theft From Motor Vehicle"
offense_code: "23F"
offense_end_datetime: "2020-11-12 01:13:00"
offense_id: "17610774065"
offense_parent_group: "LARCENY-THEFT"
offense_start_datetime: "2020-11-12 01:11:00"
precinct: "E"
report_datetime: "2020-11-14 10:12:31"
report_number: "2020-925762"
sector: "C"
_100_block_address: "18XX BLOCK OF 38TH AVE E"
 */

function querySeattleSocrata(lat, lng) {
  // Build boundaries of query
  const max = addToLatLng(lat, lng, radius, radius);
  const min = addToLatLng(lat, lng, -radius, -radius);

  //const datequery = `AND to_fixed_timestamp( '2020-01-01T00:00:00Z' ) <
  // to_fixed_timestamp( offense_start_datetime , '%Y-%m-%d %H:%M:%S' )`
  const where = `$where=latitude <= ${max.lat} AND longitude <= ${max.lng} ` +
    `AND latitude >= ${min.lat} AND longitude >= ${min.lng}`;
  const order = '$order=offense_start_datetime DESC'
  const query = SOCRATA_ENDPOINT + '?' + where + '&' + order;

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

function filterEvents(events, relativeYears) {
  let output = [];
  events.forEach(event => {
    const startDate = moment(event.offense_start_datetime);
    const minDate = moment().subtract(relativeYears, 'years');
    if (startDate >= minDate) {
      output.push(event);
    }
  })
  return output;
}

// Returns a map of event report_numbers to the events.
function processEvents(events) {
  // First filter out any events not expected.
  events = filterEvents(events, relativeYears);

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
    let eventDateTime = moment(event.offense_start_datetime).format("lll");
    let title = event.offense + ' - ' + eventDateTime;
    newMarker = L.marker([event.latitude, event.longitude], { title: title });
    newMarker.bindPopup(`<b alt>${event.offense}</b><br>Time: ${eventDateTime}<br>Report Number: ${event.report_number}<br>Block: ${event._100_block_address}`)

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
  let accessToken = getRandomString([
    'pk.eyJ1IjoiYXN5bmNsaW5rMiIsImEiOiJjbHkwdHJndW4wdHR2MmtvbHMzZGc5bm1wIn0.XbczWvlJj46Sb5kPJghUNA',
    'pk.eyJ1IjoiYXN5bmNsaW5rMSIsImEiOiJjbHhxeXB5cmkwZzIwMmlxN3A4ZWJ4NWV4In0.ZcpWR3y2hmxX9svxo8j4mg'
  ])

  L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    minZoom: 11,
    maxZoom: 19,
    id: 'mapbox/streets-v12',
    tileSize: 512,
    zoomOffset: -1,
    accessToken: accessToken
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