# SeattleCrimeMap

A website to display historic Seattle crime data on a map. This data is obtained from the public [Seattle Socrata API](https://data.seattle.gov/Public-Safety/SPD-Crime-Data-2008-Present/tazs-3rd5/about_data), which provides data on crime. This site is not funded or backed by any official Seattle source, just developed in the spare time of a local resident 😊

Public data on crimes is not specific to the actual address where the crime occurred, it is usually just on a specific block. That's why most pins are grouped together.

# Map Display

This uses Leaflet and Mapbox to display the results in an easy to understand way. Groups together of pins from the same block with info on each individual crimes. 

> [!WARNING]  
> This website is reaching limits on Mapbox's free API usage limits, due to the popularity of the site now. This website is not funded, and will need to be taken down soon if the demand continues. Please reach out to your local representatives or the Seattle Police Department if you would like an officiall map like this developed.