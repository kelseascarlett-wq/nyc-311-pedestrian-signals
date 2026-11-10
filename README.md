# Waiting for the Walk Signal

An interactive investigation of how long New York City 311 pedestrian-signal reports remained open in 2025, and how median administrative closure times varied across neighborhoods.

## Research question

How long do pedestrian-signal reports remain open in New York City's 311 system, and how does the typical closure time vary across neighborhoods?

## What the site includes

- An interactive neighborhood map of median administrative closure times
- A ranked comparison of eligible neighborhood areas
- A distribution of individual request closure times
- Methodological limitations and proposed next steps

The project is a static website. D3 renders the visualizations in the visitor's browser from the included GeoJSON and JSON files; it does not require a database or server-side application.

## Data and interpretation

The analysis uses 2025 records from NYC Open Data's **311 Service Requests from 2020 to Present**, filtered to requests assigned to the Department of Transportation with complaint type `Traffic Signal Condition` and descriptor `Pedestrian Signal`.

A 311 `Closed Date` records when the city closed the administrative record. It does not necessarily identify the date of inspection or repair. Each row represents a request, not necessarily a unique signal, defect, intersection, or repair event.

## Run locally

Because the project loads local JSON and GeoJSON files, view it through a local web server rather than opening `index.html` directly:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000/`.

## Project files

```text
index.html
interactive.css
interactive.js
assets/
  neighborhoods.geojson
  neighborhood-summary.json
```

## Sources

- [NYC Open Data: 311 Service Requests from 2020 to Present](https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2020-to-Present/erm2-nwe9/about_data)
- [NYC Department of City Planning: 2020 Neighborhood Tabulation Areas](https://data.cityofnewyork.us/City-Government/2020-Neighborhood-Tabulation-Areas-NTAs-/9nt8-h7nd)
- [NYC311: Pedestrian Signal Complaint or Request](https://portal.311.nyc.gov/article/?kanumber=KA-01047)

## Author

Kelsea Scarlett
