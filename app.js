
const SOCRATA_ENDPOINT = 'https://data.seattle.gov/resource/tazs-3rd5.json'

let map;
let radius = 500; // feet radius to search
let relativeDays = 182; // days to search back
let markers = [];

function onMapClick(e) {
    let popup = L.popup();

    popup
        .setLatLng(e.latlng)
        .setContent("You clicked the map at " + e.latlng.toString())
        .openOn(map);

    querySeattleSocrata(e.latlng.lat, e.latlng.lng);
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

    //const datequery = `AND to_fixed_timestamp( '2020-01-01T00:00:00Z' ) < to_fixed_timestamp( offense_start_datetime , '%Y-%m-%d %H:%M:%S' )`
    const where = `$where=latitude <= ${max.lat} AND longitude <= ${max.lng} AND latitude >= ${min.lat} AND longitude >= ${min.lng}`;
    // const query = SOCRATA_ENDPOINT + '?report_number=2011-409287';
    const order = '$order=offense_start_datetime DESC'
    const query = SOCRATA_ENDPOINT + '?' + where + '&' + order;

    console.log(query);
    console.log(encodeURI(query));
    fetch(encodeURI(query))
        .then(res => res.json())
        .then((out) => {
            makeMarkers(out);
        })
        .catch(err => { throw err });
}

function makeMarkers(events) {
    console.log('Checkout this JSON! ', events);
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];


    events.forEach(event => {
        let newMarker = L.marker([event.latitude, event.longitude], {title: event.offense});
        markers.push(newMarker);
        newMarker.addTo(map);
    });
}


function init() {
    map = L.map('mapid').setView([47.6072, -122.3321], 12);

    L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        maxZoom: 18,
        id: 'mapbox/streets-v11',
        tileSize: 512,
        zoomOffset: -1,
        accessToken: 'pk.eyJ1IjoiYXN5bmNsaW5rIiwiYSI6ImNraHd5cm5jOTAwNnUyeHBjeXJrOHB5NTkifQ.v5a6KbFQHti809og2pxSRw'
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
        const radlat1 = Math.PI * lat1/180;
        const radlat2 = Math.PI * lat2/180;
        const theta = lng1-lng2;
        const radtheta = Math.PI * theta/180;
        let dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
        if (dist > 1) {
            dist = 1;
        }
        dist = Math.acos(dist);
        dist = dist * 180/Math.PI;
        dist = dist * 60 * 1.1515 * 5280;
        return dist;
    }
}

// https://stackoverflow.com/questions/7477003/calculating-new-longitude-latitude-from-old-n-meters
function addToLatLng(lat, lng, feetY=0, feetX=0) {
    const earth = 6378.137; // radius of the earth in kilometers
    const meterInDegree = (1 / ((2 * Math.PI / 360) * earth)) / 1000;  // 1 meter in degree

    const metersY = feetY / 3.2808;
    const metersX = feetX / 3.2808;

    const newLat = lat + (metersY * meterInDegree);
    const newLng = lng + (metersX * meterInDegree) / Math.cos(lat * (Math.PI / 180));
    return L.latLng(newLat, newLng);
}


window.onload = function(){
    init();
};