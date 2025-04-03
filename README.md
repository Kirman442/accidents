# React + Supabase + Deck.gl
Germany Road traffic Accidents Visualization

Interactive accident map in Germany with filtering by:
- Country regions
- Days of the week
- Accident categories
- Visualisation types (hexagons/heat map)

## Technologies
- **Deck.gl** as GPU-powered framework for 3D visualisation
- **React** + **Vite** 
- **Supabase** as Database
- Dark theme with accent colours

## Traffic accidents
The road traffic accident statistics record all accidents involving personal injury or property damage on public roads and squares that are recorded by the police. The dataset contains data on accident victims by age, vehicle type (e.g. car, motorcycle or bus accidents) and cause of accident. We record driver-related causes such as drink-driving or speeding as well as road accidents caused by icy roads, fog or accidents involving wild animals. In addition to road traffic accidents, we also publish data on accidents involving pedestrians, cyclists and, more recently, accidents involving electric scooters. Not all fields have been used for filtering; incidents involving motorcycles, goods vehicles and other vehicles are missing, and there is no filtering according to the following values: road conditions, light conditions, accident type and accident type.

## Explanatory notes
- Accident with passenger car: accident in which at least one passenger car was involved.
- Accident with bicycle: accident in which at least one bicycle was involved.
- Accident with pedestrian: accident in which at least one pedestrian was involved.
- Accident with motorcycle: accident in which at least one motorcycle (including motor-assisted bicycle, scooter) was involved.
- Accident with goods road vehicle: accident in which at least one delivery van or motor lorry with a total weight of more than 3.5 tonnes, a motor lorry with a container for dangerous goods on the loading area or with a special body, a semi-trailer truck or other tractor was involved (for 2017, this category is included under accident with other).
- Accident with other: accident in which at least one means of transport not mentioned above was involved, e.g. a bus or a tram

- Persons killed: persons who died within 30 days as a result of the accident.
- Persons seriously injured: persons who were immediately taken to hospital for in-patient treatment (of at least 24 hours).
- Persons slightly injured: any other persons injured.

## How are the accident data processed?
Road traffic accidents are accidents due to vehicular traffic on public roads or places, with persons killed or injured or involving material damage.
The Accident Atlas contains accidents with personal injury. Accidents involving only material damage are not shown.
The Accident Atlas contains data from the statistics of road traffic accidents, which are based on reports from police stations.
When recording the accident, the police also record the geographical coordinates of the place of accident. These accident coordinates are processed and then shown in the Accident Atlas.

To visualise accident hotspots in maps, individual accidents are grouped by road section. The number of accidents is determined for every road section, which is then colour coded. Zooming into a road section will make the places of accidents visible as dots at road level.

The data have to be checked for plausibility so that the accident coordinates can be correctly allocated to the relevant road sections. This includes comparing the accident data with the road geometry determined by the land surveying authorities. The distance between the accident coordinates and a road section is determined. In addition, it is assessed whether the information collected by the police station regarding the road name (e.g. “B54”) and the road category (motorway, federal road, Land road, etc.) corresponds to the data of the land surveying authorities.

Then the accident coordinates are represented as a dot on the relevant road section. Data not meeting the requirements are eliminated and not shown in the Accident Atlas. Generally, the rates of successfully allocating accident coordinates to a road section are clearly above 90% in the Länder. The rates may however differ markedly in individual municipalities. In rare cases, this may lead to local accident frequencies not being represented.

In Rheinland-Pfalz and Saarland, in most cases, the geo-coordinates of the places of accidents are determined only at the police station on the basis of the network node data recorded. The geo-coordinates then transmitted to the relevant Land statistical office are always positioned in the middle of the road. Consequently, accidents on roads with a median strip are placed on the median strip even if they actually occurred on one of the two sides of the road. A plausibility algorithm of the Federal Statistical Office automatically places such accidents on the nearest road axis. Thus it may happen that accidents on roads with a median strip are placed on the wrong road side in the atlas.