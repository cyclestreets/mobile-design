var cyclestreetsui = (function ($) {
	
	'use strict';
	
	// Default settings
	var _settings = {
		
		// CycleStreets API
		apiBaseUrl: 'https://api.cyclestreets.net',
		apiKey: 'YOUR_API_KEY',
		
		// Mapbox API key
		mapboxApiKey: 'MAPBOX_ACCESS_TOKEN',

		// Login-in URL
		userAuthenticationUrl: '{%apiBaseUrl}/v2/user.authenticate?key={%apiKey}',

		// Account creation URL
		accountCreationUrl: '{%apiBaseUrl}/v2/user.create?key={%apiKey}',

		// Password reset URL #¡# No API support yet
		passwordResetUrl: 'https://www.cyclestreets.net/signin/resetpassword/',
		
		// Initial lat/long/zoom of map and tile layer
		defaultLocation: {
			latitude: 53.78,
			longitude: -2.37,
			zoom: 5
		},
		defaultTileLayer: 'opencyclemap',
		
		// Default layers ticked
		defaultLayers: ['photomap'],
		
		// Icon size, set globally for all layers
		iconSize: [38, 42],
		
		// Enable scale bar
		enableScale: true,
		
		// First-run welcome message
		firstRunMessageHtml: '<p>Welcome to CycleStreets.</p>',

		// Use existing geolocation button instead of Mapbox's
		geolocationElementId: 'geolocate-button',

		// Images; size set in CSS with .itinerarymarker
		images: {
			start: '/images/pin-A.svg',
			waypoint: '/images/pin-V.svg',
			finish: '/images/pin-B.svg'
		},

		// Whether to plan routes the moment the map is clicked rather than wait until a routing button is pressed
		planRoutingOnMapClick: false,

		// Whether to show the basic Mapbox toolbox
		showToolBox: false,

		// Images; size set in CSS with .itinerarymarker
		images: {
			start: '/images/itinerarymarkers/start.png',
			waypoint: '/images/itinerarymarkers/waypoint.png',
			finish: '/images/itinerarymarkers/finish.png'
		},

		// Array with default POI(s) to show when opening the POIs card. This can either be a single POI or multiple
		defaultPoi: ['cycleparking'],

		// Hide default LayerViewer message area and legend
		hideExtraMapControls: true
		
	};
	
	// Class properties
	var _map = null;
	var _breadcrumbs = []; // Breadcrump trail used when clicking left chevrons
	var _isMobileDevice = true;
	var _panningEnabled = false
	var _recentJourneys = []; // Store the latest planned routes
	var _recentSearches = []; // Store recent searches, used to populate the JP card
	var _poisActivated = []; // Store the POIs activated
	var _settingLocationName = null; // When we are setting a frequent location, save which kind of location
	var _shortcutLocations = ['home', 'work']; // Store shortcut locations in settings menu and JP card
	var _notificationQueue = []; // Store any notifications in a queue

	// Enable panels and additional functionality
	var _actions = [
		'journeyPlanner',
		'rideTracker',
		'settings',
		'pois',
		'loginAndSignup'
	];

	// Layer definitions
	var _layerConfig = {
		
		collisions: {
			apiCall: '/v2/collisions.locations',
			apiFixedParameters: {
				jitter: '1',
				datetime: 'friendly'
			},
			fullZoom: 17,
			parameterNamespace: 'field:',		// See: https://www.cyclestreets.net/api/v2/collisions.locations/
			sendZoom: true,	// Needed for jitter support
			iconField: 'severity',
			icons: {
				slight:  '/images/icons/icon_collision_slight.svg',
				serious: '/images/icons/icon_collision_serious.svg',
				fatal:   '/images/icons/icon_collision_fatal.svg'
			},
			markerImportance: ['slight', 'serious', 'fatal'],
			popupHtml:
				  '<p><a href="{properties.url}"><img src="/images/icons/bullet_go.png" /> <strong>View full, detailed report</a></strong></p>'
				+ '<p>Reference: <strong>{properties.id}</strong></p>'
				+ '<p>'
				+ 'Date and time: <strong>{properties.datetime}</strong><br />'
				+ 'Severity: <strong>{properties.severity}</strong><br />'
				+ 'Casualties: <strong>{properties.casualties}</strong><br />'
				+ 'No. of Casualties: <strong>{properties.Number_of_Casualties}</strong><br />'
				+ 'No. of Vehicles: <strong>{properties.Number_of_Vehicles}</strong>'
				+ '</p>'
		},
		
		taxidata: {
			apiCall: '/v2/advocacydata.taxis',
			iconUrl: '/images/icons/road_neutral.svg',
			heatmap: true
		},
		
		trafficcounts: {
			apiCall: '/v2/trafficcounts.locations',
			apiFixedParameters: {
				groupyears: '1'
			},
			iconUrl: '/images/icons/icon_congestion_bad.svg',
			lineColourField: 'car_pcu',	// #!# Fixme - currently no compiled all_motors_pcu value
			lineColourStops: [
				[40000, '#ff0000'],	// Colour and line values based on GMCC site
				[20000, '#d43131'],
				[10000, '#e27474'],
				[5000, '#f6b879'],
				[2000, '#fce8af'],
				[0, '#61fa61']
			],
			lineWidthField: 'cycle_pcu',	// #!# Fixme - should be Daily cycles
			lineWidthStops: [
				[1000, 10],
				[500, 8],
				[100, 6],
				[10, 4],
				[0, 2],
			],
			popupHtml:	// Popup code thanks to https://hfcyclists.org.uk/wp/wp-content/uploads/2014/02/captions-html.txt
				  '<p>Count Point {properties.id} on <strong>{properties.road}</strong>, a {properties.road_type}<br />'
				+ 'Located in {properties.wardname} in {properties.boroughname}<br />'
				+ '[macro:yearstable({properties.minyear}, {properties.maxyear}, cycles;p2w;cars;buses;lgvs;mgvs;hgvs;all_motors;all_motors_pcu, Cycles;P2W;Cars;Buses;LGVs;MGVs;HGVs;Motors;Motor PCU)]'
				+ '<p><strong>{properties.maxyear} PCU breakdown -</strong> Cycles: {properties.cycle_pcu}, P2W: {properties.p2w_pcu}, Cars: {properties.car_pcu}, Buses: {properties.bus_pcu}, LGVs: {properties.lgv_pcu}, MGVs: {properties.mgv_pcu}, HGVs: {properties.hgv_pcu}</p>'
				+ '</div>'
		},
		
		planningapplications: {
			apiCall: 'https://www.planit.org.uk/api/applics/geojson',
			apiFixedParameters: {
				pg_sz: 100,
				limit: 100
			},
			apiKey: false,
			iconUrl: '/images/icons/signs_neutral.svg',
			iconSizeField: 'app_size',
			iconSizes: {
				'Small': [24, 24],
				'Medium': [36, 36],
				'Large': [50, 50],
			},
			popupHtml:
				  '<p><strong>{properties.description}</strong></p>'
				+ '<p>{properties.address}</p>'
				+ '<p>Size of development: <strong>{properties.app_size}</strong><br />'
				+ 'Type of development: <strong>{properties.app_type}</strong><br />'
				+ 'Status: <strong>{properties.app_state}</strong></p>'
				+ '<p>Reference: <a href="{properties.url}">{properties.uid}</a><br />'
				+ 'Local Authority: {properties.authority_name}<br />'
				+ 'Date: {properties.start_date}</p>'
				+ '<p><a href="{properties.url}"><img src="images/icons/bullet_go.png" /> <strong>View full details</a></strong></p>'
		},
		
		bikeshare: {
			apiCall: '/v2/pois.locations',
			apiFixedParameters: {
				type: 'londoncyclehire',	// NB This value likely to be changed (generalised) in future
				limit: 400
			},
			iconField: 'iconUrl',
			iconSize: [28, 28],
			popupHtml:
				  '<p><strong>Cycle hire dock</strong></p>'
				+ '<p>{properties.name}</p>'
				+ '<p>{properties.notes}</p>'
		},
		
		triplengths: {
			apiCall: '/v2/usage.journeylengths',
			polygonStyle: 'grid',
			popupHtml:
				  '<p>Average distance: <strong>{properties.distance}km</strong>'
		},
		
		pois: {
			apiCall: '/v2/pois.locations',
			apiFixedParameters: {
				fields: 'id,name,osmTags[capacity,access,bicycle_parking,covered],nodeId',
				limit: 400
			},
			iconUrl: '/images/icons/cycleparking_good.svg',
			//iconField: 'iconUrl',		// icons specified in the field value
			iconSize: [24, 24],
			popupHtml:
				  '<p><strong>Cycle parking</strong></p>'
				+ '<table>'
				+ '<tr><td>Spaces:</td><td>{properties.Capacity}</td></tr>'
				+ '<tr><td>Access:</td><td>{properties.Access}</tr>'
				+ '<tr><td>Type:</td><td>{properties.Bicycle_parking}</tr>'
				+ '<tr><td>Covered?:</td><td>{properties.Covered}</tr>'
				+ '</table>'
				+ '<p class="edit"><a href="https://www.openstreetmap.org/edit?node={properties.nodeId}" target="_blank">Add/edit details</a></p>'
		},
		
		// https://data.police.uk/docs/method/crime-street/
		// https://data.police.uk/api/crimes-street/bicycle-theft?poly=52.199295,0.124497:52.214312,0.124497:52.214312,0.1503753:52.1992,0.15037:52.19929,0.1244&date=2016-07
		cycletheft: {
			apiCall: 'https://data.police.uk/api/crimes-street/bicycle-theft',
			retrievalStrategy: 'polygon',
			flatJson: ['location.latitude', 'location.longitude'],
			apiKey: false,
			apiBoundaryField: 'poly',
			apiBoundaryFormat: 'latlon-comma-colons',
			iconUrl: '/images/icons/icon_enforcement_bad.svg',
			popupHtml:
				  '<p>Crime no.: <strong>{properties.persistent_id}</strong></p>'
				+ '<p>'
				+ 'Date: <strong>{properties.month}</strong><br />'
				+ 'Location: <strong>{properties.location.street.name}</strong><br />'
				+ 'Outcome: <strong>{properties.outcome_status.category}</strong><br />'
				+ '</p>'
				+ '<p>Note: The location given in the police data is <a href="https://data.police.uk/about/#location-anonymisation" target="_blank" title="See more details [link opens in a new window]">approximate</a>, for anonymity reasons.</p>'
		},
		
		// https://www.cyclescape.org/api
		issues: {
			apiCall: 'https://www.cyclescape.org/api/issues.json',
			apiKey: false,
			apiFixedParameters: {
				page: 1,
				per_page: 100
			},
			iconUrl: '/images/icons/destinations_bad.svg',
			polygonStyle: 'red',
			popupHtml:
				  '<p><strong><a href="{properties.cyclescape_url}">{properties.title}</a></strong></p>'
				+ '<div class="scrollable">'
				+ '{properties.description}'	// Already HTML
				+ '</div>'
				+ '<p><a href="{properties.cyclescape_url}">Full details</a></p>'
		},
		
		photomap: {
			apiCall: '/v2/photomap.locations',
			apiFixedParameters: {
				fields: 'id,captionHtml,hasPhoto,thumbnailUrl,url,username,licenseName,iconUrl,categoryName,metacategoryName,datetime,apiUrl',
				limit: 150,
				thumbnailsize: 300,
				datetime: 'friendlydate'
			},
			iconField: 'iconUrl',		// icons specified in the field value
			useManualPopup: '.popup.photomap',
			popupHtml: {selector: '.popup.photomap'},
			//popupHtml: '', Populated automatically in initialise
			/*
			//popupOld: '<div class="popup photomap">'
				+ '<div class="inner-card flip-card-inner">'
				+ '<div class="flip-card-front popup-card">'
				+ '<img class="popup-photo" src="placeholders/photomap-add-comments-placeholder.svg" alt="Photo" />'
				+ '<a href="#" class="ui-button close-button" title="Close this popup"><img src="/images/icon-cross-red.svg" alt="Close icon" /></a>'
				+ '<a href="#" title="Share this location"><img src="/images/icon-share.svg" alt="Share icon" /> Share</a>'
				+ '<a class="flip" href="#" title="Show more information"> Photo info</a>'
				+ '</div>'
				+ '<div class="flip-card-back popup-card">'
				+ '<a href="#" class="back" title="Return to the front of this card"><img src="/images/icon-disclosure-red-left.svg" alt="Left chevron" /></a>'
				+ '<a href="#" class="ui-button close-button" title="Close this popup"><img src="/images/icon-cross-red.svg" alt="Close icon" /></a>'
				+ '<br>'
				+ '<p class="key">Category:</p>'
				+ '<p>Cycle parking</p>'
				+ '<br>	'
				+ '<p class="key">Type:</p>'
				+ '<p>Neutral</p>'
				+ '<hr /><ul>'
				+ '<li><img src="/images/icon-user.svg" alt="User icon" />'
				+ '<p>timbo</p>'
				+ '</li>'
				+ '<li>'
				+ '<img src="/images/icon-clock.svg" alt="Clock icon" />'
				+ '<p>1:16pm, 8th August, 2018</p>'
				+ '</li>'
				+ '<li>'
				+ '<img src="/images/icon-hashtag.svg" alt="Photo number" />'
				+ '<p>92334</p>'
				+ '</li>'
				+ '<li>'
				+ '<img src="/images/icon-copyright.svg" alt="Copyright" />'
				+ '<p>CC Attribution-Share Alike (by-sa)</p>'
				+ '</li>'
				+ '</ul>'
				+ '</div></div></div>'



				+ '<p><a href="/photomap/{properties.id}/" id="details" data-url="{properties.apiUrl}&thumbnailsize=800"><img src="{properties.thumbnailUrl}" /></a></p>'
				+ '<div class="scrollable">'
				+ '<strong>{properties.captionHtml}</strong>'
				+ '</div>'
				+ '<table>'
				+ '<tr><td>Datsdsde:</td><td>{properties.datetime}</td></tr>'
				+ '<tr><td>By:</td><td>{properties.username}</td></tr>'
				+ '<tr><td>Category:</td><td>{properties.categoryName} &mdash; {properties.metacategoryName}</td></tr>'
				+ '</table>'
				+ '<p><a href="{properties.url}"><img src="images/icons/bullet_go.png" /> <strong>View full details</a></strong></p>',
			*/
			detailsOverlay: 'apiUrl',
			overlayHtml:
				  '<table class="fullimage">'
				+ '<tr>'
				+ '<td>'
				+ '<p><img src="{properties.thumbnailUrl}" /></p>'
				+ '</td>'
				+ '<td>'
				+ '<p>'
				+ '<strong>{properties.caption}</strong>'
				+ '</p>'
				+ '<table>'
				// + '<tr><td>Date:</td><td>{properties.datetime}</td></tr>'
				+ '<tr><td>By:</td><td>{properties.username}</td></tr>'
				// + '<tr><td>Category:</td><td>{properties.categoryName} &mdash; {properties.metacategoryName}</td></tr>'
				+ '</table>'
				+ '{%streetview}'
				+ '</td>'
				+ '</tr>'
				+ '</table>'
		},
		
		// https://wiki.openstreetmap.org/wiki/Strava
		strava: {
			apiCall: false,
			apiKey: false,
			tileLayer: {
				tiles: 'https://tile.cyclestreets.net/strava/ride/{%style}/{z}/{x}/{y}@2x.png',	// E.g. https://heatmap-external-c.strava.com/tiles/ride/blue/11/1026/674.png?v=19
				maxZoom: 11.999,
				attribution: 'Strava heatmap',
				tileSize: 512,
				label: 'Strava heatmap'
			}
		},
		
		// https://www.cyipt.bike/api/#width
		widths: {
			apiCall: 'https://www.cyipt.bike/api/v1/width.json',
			sendZoom: true,
			lineColourField: 'width',
			lineColourStops: [
				[14, '#4575b4'],
				[12, '#74add1'],
				[10, '#abd9e9'],
				[8, '#e0f3f8'],
				[6, '#fee090'],
				[4, '#fdae61'],
				[2, '#f46d43'],
				[0, '#d73027']
			],
			lineWidthField: 'width',
			lineWidthStops: [
				[21, 8],
				[14, 7],
				[8, 6],
				[5, 5],
				[3, 4],
				[0, 3],
			],
			popupHtml:
				  '<p>Width: {properties.width}</p>'
				+ '{%streetview}'
		},
		
		// https://www.cyclestreets.net/api/v2/mapdata/
		cycleability: {
			apiCall: '/v2/mapdata',
			apiFixedParameters: {
				limit: 400,
				types: 'way'
			},
			sendZoom: true,
			popupHtml:
				  '<table>'
				+ '<tr><td>Name:</td><td><strong>{properties.name}</strong></td></tr>'
				+ '<tr><td>OSM ID:</td><td><a href="https://www.openstreetmap.org/way/{properties.id}" target="_blank" title="[Link opens in a new window]">{properties.id}</a></td></tr>'
				+ '<tr><td>Cycleable?</td><td>{properties.cyclableText}</td></tr>'
				+ '<tr><td>Quietness:</td><td><strong>{properties.quietness}</strong></td></tr>'
				+ '<tr><td>Speed rating</td><td>{properties.speed}</td></tr>'
				+ '<tr><td>Pause</td><td>{properties.pause}</td></tr>'
				+ '<tr><td>Type</td><td>{properties.ridingSurface}</td></tr>'
				+ '</table>'
				+ '<p>{%osmeditlink}</p>'
		},
		
		// https://www.cyclescape.org/api
		groups: {
			apiCall: 'https://www.cyclescape.org/api/groups.json',
			apiKey: false,
			polygonStyle: 'green',
			popupHtml:
				  '<p><strong>{properties.title}</strong></p>'
				+ '<p>{properties.description}</p>'
				+ '<p><a href="{properties.url}">Cyclescape group</a></p>'
		},
		
		// https://www.cyclestreets.net/api/v2/isochrones.show/
		howfar: {
			apiCall: '/v2/isochrones.show',
			iconUrl: '/images/icons/destinations_good.svg',
			setMarker: 'lonlat',
			polygonStyle: 'blue'
		},
		
		// https://www.cyclestreets.net/api/v2/infrastructure.locations/
		tflcid: {
			apiCall: '/v2/infrastructure.locations',
			apiFixedParameters: {
				dataset: 'tflcid',
				thumbnailsize: 400
			},
			iconSize: [24, 24],
			iconField: 'iconUrl',
			style: {
				LineString: {
					'line-color': 'red',
					'line-width': 3
				}
			},
			popupImagesField: 'images',
			popupLabels: {
				ss_road: 'Road marking',
				ss_patch: 'Coloured patch on surface',
				ss_facing: 'Facing off-side',
				ss_nocyc: 'No cycling',
				ss_noveh: 'No vehicles',
				ss_circ: 'Circular/Rectangular',
				ss_exempt: 'Exemption',
				ss_noleft: 'No left turn exception',
				ss_norigh: 'No right turn exception',
				ss_left: 'Compulsory turn left exception',
				ss_right: 'Compulsory turn right exception',
				ss_noexce: 'No straight ahead exception',
				ss_dismou: 'Cyclists dismount',
				ss_end: 'End of Route',
				ss_cycsmb: 'Cycle symbol',
				ss_pedsmb: 'Pedestrian symbol',
				ss_bussmb: 'Bus symbol',
				ss_smb: 'Other vehicle symbol',
				ss_lnsign: 'Line on sign',
				ss_arrow: 'Direction arrow',
				ss_nrcol: 'Road marking or Sign includes a number in a box',
				ss_ncn: 'National Cycle Network',
				ss_lcn: 'London Cycle Network',
				ss_superh: 'Cycle Superhighway',
				ss_quietw: 'Quietway',
				ss_greenw: 'Greenway',
				ss_routen: 'Route Number',
				ss_destn: 'Destination',
				ss_access: 'Access times',
				ss_name: 'TSRGD Sign number',
				ss_colour: 'Colour of Patch',
				sig_head: 'Cycle signal head',
				sig_separa: 'Separate stage for cyclists',
				sig_early: 'Early release',
				sig_twostg: 'Two stage turn',
				sig_gate: 'Cycle gate/Bus gate',
				trf_raised: 'Raised table',
				trf_entry: 'Raised side road entry treatment',
				trf_cushi: 'Speed cushions',
				trf_hump: 'Speed hump',
				trf_sinuso: 'Sinusoidal',
				trf_barier: 'Barrier',
				trf_narow: 'Carriageway narrowing',
				trf_calm: 'Other traffic calming',
				rst_steps: 'Steps',
				rst_lift: 'Lift',
				prk_carr: 'Carriageway',
				prk_cover: 'Covered',
				prk_secure: 'Secure',
				prk_locker: 'Locker',
				prk_sheff: 'Sheffield',
				prk_mstand: 'M stand',
				prk_pstand: 'P stand',
				prk_hoop: 'Cyclehoop',
				prk_post: 'Post',
				prk_buterf: 'Butterfly',
				prk_wheel: 'Wheel rack',
				prk_hangar: 'Bike hangar',
				prk_tier: 'Two tier',
				prk_other: 'Other / unknown',
				prk_provis: 'Provision',
				prk_cpt: 'Capacity',
				clt_carr: 'On / Off Carriageway',
				clt_segreg: 'Segregated lane / track',
				clt_stepp: 'Stepped lane / track',
				clt_parseg: 'Partially segregated lane / track',
				clt_shared: 'Shared lane or footway',
				clt_mandat: 'Mandatory cycle lane',
				clt_advis: 'Advisory cycle lane',
				clt_priori: 'Cycle lane/track priority',
				clt_contra: 'Contraflow lane/track',
				clt_bidire: 'Bi-directional',
				clt_cbypas: 'Cycle bypass',
				clt_bbypas: 'Continuous cycle facilities at bus stop',
				clt_parkr: 'Park route',
				clt_waterr: 'Waterside route',
				clt_ptime: 'Full-time / Part-time',
				clt_access: 'Access times',
				asl_fdr: 'Feeder lane',
				asl_fdrlft: 'Feeder lane on left',
				asl_fdcent: 'Feeder Lane in centre',
				asl_fdrigh: 'Feeder lane on right',
				asl_shared: 'Shared nearside lane',
				crs_signal: 'Signal controlled crossing',
				crs_segreg: 'Segregated cycles and pedestrians',
				crs_cygap: 'Cycle gap',
				crs_pedest: 'Pedestrian Only Crossing',
				crs_level: 'Level Crossing',
				res_pedest: 'Pedestrian only route',
				res_bridge: 'Pedestrian bridge',
				res_tunnel: 'Pedestrian tunnel',
				res_steps: 'Steps',
				res_lift: 'Lift',
				colour: 'Surface colour',
				road_name: 'Road name',
				osm_id: 'OSM way ID assignment',
				'_type': 'Asset type'
			},
			popupFormatters: {
				osm_id: function (value, feature) {return '<a href="https://www.openstreetmap.org/way/' + value + '" target="_blank">' + value + '</a>';}
			}
		},
		
		// OpenStreetMap; see: https://wiki.openstreetmap.org/wiki/API_v0.6
		osm: {
			apiCall: 'https://www.openstreetmap.org/api/0.6/map',	// Will return XML; see: https://wiki.openstreetmap.org/wiki/API_v0.6#Retrieving_map_data_by_bounding_box:_GET_.2Fapi.2F0.6.2Fmap
			bbox: true,
			dataType: 'xml',
			minZoom: 19,
			fullZoom: 19,
			fullZoomMessage: 'OSM data is only available from zoom 19 - please zoom in further.',
			style: {
				LineString: {
					'line-color': 'red',
					'line-width': 3
				}
			},
			convertData: function (osmXml) {
				var geojson = osm2geo (osmXml);		// Requires osm2geo from https://gist.github.com/tecoholic/1396990
				geojson.features = geojson.features.filter (function (feature) { return (feature.geometry.type == 'LineString') });	// See: https://stackoverflow.com/a/2722213
				return geojson;
			}
		}
	};
	
	
	return {
		
		// Main function
		initialise: function (config)
		{
			// Merge the configuration into the settings
			$.each (_settings, function (setting, value) {
				if (config.hasOwnProperty (setting)) {
					_settings[setting] = config[setting];
				}
			});
			
			
			// Run the layerviewer for these settings and layers
			layerviewer.initialise (_settings, _layerConfig);
			_map = layerviewer.getMap ();

			// Autocomplete
			cyclestreetsui.autocomplete ();
			
			// Initialise the UI
			cyclestreetsui.mainUI ();
			cyclestreetsui.navBar ();
			cyclestreetsui.popupActions ();
			
			// Initialise developerTools
			cyclestreetsui.developerTools ();
			
			// Initialise each section
			$.each (_actions, function (setting, action) {
				cyclestreetsui[action] ();
			});

			// Add routing
			cyclestreetsui.routing ();

			// Get POIS icon URLs
			//cyclestreetsui.getPoisIconUrls ();

			// Trigger geolocation to find the user's location at startup
			layerviewer.triggerGeolocation ();
			
			// Show the default panel, after a slight pleasing delay
			$('.panel.journeyplanner.search').delay (300).slideToggle ('slow');
			
		},
		
		
		// Routing
		routing: function ()
		{
			// Delegate to separate class
			routing.initialise (_settings, _map, _isMobileDevice, _panningEnabled);
		},
		
		// Autocomplete
		autocomplete: function ()
		{
			// Enable autocomplete for Photomap tags; see: https://stackoverflow.com/a/21398000/180733
			$('#photomap input[name="tags"]').autocomplete({
				minLength: 3,
				source: function (request, response) {
					$.ajax({
						dataType: 'json',
						type : 'GET',
						url: _settings.apiBaseUrl + '/v2/photomap.tags?key=' + _settings.apiKey + '&limit=10',
						data: {
							match: request.term
						},
						success: function (data) {
							response ($.map (data, function (item) {
								return {
									label: item.tag,
									value: item.tag
								}
							}));
						}
					});
				}
			});
		},
		
		// Layer-specific behaviour
		tflCid: function ()
		{
			// Provide drop-down filters based on feature type, firstly getting the schema from the server
			$.ajax({
				url: _settings.apiBaseUrl + '/v2/infrastructure.schema?dataset=tflcid&key=' + _settings.apiKey,
				success: function (schema) {
					
					// Load description for type dropdown and filters
					var field = $("form #tflcid select[name='type']").val ();
					cyclestreetsui.setFilters (schema, field);
					$("form #tflcid select[name='type']").on ('change', function () {
						cyclestreetsui.setFilters (schema, this.value);
					});
				}
			});
		},
		
		
		// Helper function to set the field
		setFilters: function (schema, field)
		{
			// If no field selected (i.e. blank option), set HTML to be empty
			if (!field) {
				$('#featuretypedescription p').html ('All feature types are shown. Change the box above to filter to particular asset types.');
				$('#featuretypefilters').html ('');
				return;
			}
			
			// Set description for type dropdown
			$('#featuretypedescription p').html (schema[field]['description']);
			
			// Obtain the selected fields
			var fields = schema[field]['fields'];
			
			// Create HTML controls for each field
			var html = '<p>Filter to:</p>';
			$.each (fields, function (field, attributes) {
				var fieldname = 'field:' + field;
				
				// Parse out the form field
				var matches = attributes.datatype.match (/^([A-Z]+)\((.+)\)$/);
				var type = matches[1];
				var option = matches[2];
				var widgetHtml = '';
				switch (type) {
					case 'VARCHAR':
						widgetHtml = '<input name="' + fieldname + '" type="text" maxlength=' + option + '" />';
						break;
					case 'INT':
						widgetHtml = '<input name="' + fieldname + '" type="number" maxlength=' + option + '" step="1" min="0" style="width: 4em;" />';
						break;
					case 'ENUM':
						var matches = option.match(/'[^']*'/g);		// https://stackoverflow.com/a/11227539/180733
						if (matches) {
							for (var i=0, len=matches.length; i<len; i++) {
								matches[i] = matches[i].replace(/'/g, '');
							}
						}
						widgetHtml  = '<select name="' + fieldname + '">';
						widgetHtml += '<option value="">';
						$.each (matches, function (index, value) {
							widgetHtml += '<option value="' + value + '">' + value + '</option>'
						});
						widgetHtml += '</select>';
				}
				
				// Assemble the HTML
				html += '<hr />';
				html += '<p>' + layerviewer.htmlspecialchars (attributes.field) + ':</p>';
				html += '<p>' + widgetHtml + '</p>';
				html += '<p class="smaller">' + layerviewer.htmlspecialchars (attributes.description) + '</p>';
			});
			
			// Add reset link
			// #!# Doesn't currently force a form/URL rescan
			html = '<p class="smaller right"><a id="resetfilters" href="#">[Reset filters]</a></p>' + html;
			$(document).on ('click', '#resetfilters', function (e) {
				$.each (fields, function (field, attributes) {
					var fieldname = 'field:' + field;
					$('input[name="' + fieldname + '"], select[name="' + fieldname + '"]').val (function() {return this.defaultValue;} );	// https://stackoverflow.com/a/8668089/180733
				});
				e.preventDefault ();
			});
			
			// Show the HTML
			$('#featuretypefilters').html (html);
		},
		
		// Function to go the map page
		mapPageLink: function (longitude, latitude)
		{
			var zoom = 13;		// #!# Currently fixed - need to compute dynamically, e.g. https://github.com/mapbox/mapbox-unity-sdk/issues/1125
			var targetUrl = '/map/' + '#' + zoom + '/' + latitude.toFixed(6) + '/' + longitude.toFixed(6);
			window.location.href = targetUrl;
		},
		
		
		/*
		 * Nav bar functions
		 */
		navBar: function () {
			
			// Open the nav bar
			$('#hamburger-menu').click(function() {
				$('nav').show ('slide', {direction: 'left' }, 300);
			});
			
			// Enable implicit click/touch on map as close menu			
			$('#map').click(function () {
				if ($('nav').is (':visible')) {cyclestreetsui.resetUI ();}
			});
			
			// Enable swipe-to-close
			$('nav').on('swipeleft', function () {
				$('nav').hide ('slide', {direction: 'left'}, 300);
			});
			
			// Open card from main nav items
			$('nav ul > li').click (function (event) {
				
				// Get the class name from the li
				var className = this.className.split (' ')[0];
				
				// If we clicked the sign out buttom, sign out and do not open the account panel
				if ($(this).hasClass ('signOut')) {
					cyclestreetsui.signOut ();	
					return;
				}

				// If we clicked the blog button, consider the latest post as read
				if ($(this).hasClass ('blog')) {
					cyclestreetsui.setMostRecentBlogPostAsViewed ();	
				}
				
				// If this is the data menu item, open its sub-menu
				if (className == 'data') {
					// Open the Data submenu
					$('li.data ul').slideToggle ();
				
				// Otherwise, close the nav and open the desired panel
				} else {
					
					// Enable clicking on the eye icon to deactivate a layer
					// If the target is <a href> and not directly the <label>, check to see if we are clicking the eye of a checkbox
					// If either POI or Photomap layers are deactivated, clicking the label will activate the layer with the default settings
					// If these laers are activated, clicking on the label should simply open the card; clicking the eye will deactivate the layer
					// However, if we are clicking on a Data submenu item, there is no card attached, and we DO want to activate/deactivate when clicking the label
					
					// If we are clicking on a Data submenu item, toggle the item on/off and close the menu
					if ($(event.target).parents('li.data').length) {
						cyclestreetsui.resetUI ();
						$('.panel').hide ();
						cyclestreetsui.fitMap ();
						return true;
					}
					
					// If we are clicking the Eye icon on active Photomap or POI menu item
					if ($(event.target).is('a') && ($(event.target).parents('li.photomap').length || $(event.target).parents('li.pois').length)) {
						var inputElement = $(event.currentTarget).find ('input').first();
						
						if ($(inputElement).prop ('checked') == true) {
							$(inputElement).prop ('checked', false);
							layerviewer.toggleDataLayer (inputElement[0]);		
						}

						// Do not switch to this card
						return false;
					
					// Clicking the input/label of an activated Photomap/POI layer should not disable the layer, only open the card
					} else if ($(event.target).closest('li').hasClass ('enabled')) { 
						event.preventDefault ()
						$(event.target).prop ('checked', true); // We just disactivated the input by clicking it, reactivte it
					}
					
					// Hide nav & open searchbars and all panels
					cyclestreetsui.resetUI ();
					$('.panel').hide ();
				
					// Reset the breadcrumb trail as we are starting a new "journey" from the nav
					_breadcrumbs = [];
				
					// Show the matching panel
					$('.panel.' + className).first ().slideToggle ();

					// Resize map element
					cyclestreetsui.fitMap ();
				}
			});
		},
		
		// Close the nav bar
		closeNav: function() {$('nav').hide ("slide", {direction: "left"}, 300);},

		// Fit the map to any opened card
		// Accepts an element, or attempts to find the open panel
		fitMap: function (element = false) 
		{
			// If no element is shown, find the open card
			if (!element) {
				// There should only ever be one visible card
				element = $('.panel:visible').first();
			} 
				
			var height = $(element).height();

			// Resize div, and resize map to fit the new div size
			$('#map').css({bottom: height});
			_map.resize();
		},
		
		
		/*
		 * Journey planner functions
		 */
		journeyPlanner: function ()
		{	

			// Retrieve and populate the search panel with recent searches and journeys
			cyclestreetsui.buildRecentJourneys ();
			cyclestreetsui.buildRecentSearches ();
			
			// Enable recent searches and recent journeys to show
			$('.panel.journeyplanner.search .segmented-control li').click (function (event){
				// Build the ul name from the label that was clicked
				var ulClass = event.target.textContent.toLowerCase().replace (' ', '-');

				// Hide all recent item panels except the one we clicked on
				$('.panel.journeyplanner.search .recent-items ul').hide ();
				$('.panel.journeyplanner.search .recent-items ul.' + ulClass).show('slide', {direction: 'up'}, 300);
			});

			// On startup, show the default option (recent searches)
			$('.panel.journeyplanner.search .recent-items ul.recent-journeys').hide ();
			
			// Clicking on a recent journey searches for that route again
			$('.getRecentJourneyDirections').click (function () {
				// Which recent journey was it? Access the index of the <li> we clicked
				var recentJourneyIndex = $('.getRecentJourneyDirections').index (this);
				var journey = _recentJourneys[recentJourneyIndex];
				routing.setWaypoints (journey.waypoints);

				// Get routes from waypoints already on the map
				routing.plannable (); // Will plan the route and create the result tabs

				// Switch to the card containing the tabs
				cyclestreetsui.switchPanel ('.panel.journeyplanner.search', '.panel.journeyplanner.select');

				// Resize map element
				cyclestreetsui.fitMap ('.panel.journeyplanner.select');

			});
			
			// Hide the final waypoint add button
			$('.panel.journeyplanner.search #journeyPlannerInputs').children().last().children('a.addWaypoint').hide();

			// Change opacity of #getRoutes link until routing has enabled it
			$('.panel.journeyplanner.search #getRoutes').css('opacity', 0.3);

			// Handler to open the journey planner card
			var openJourneyPlannerCard = function() {
				cyclestreetsui.openJourneyPlannerCard ();
			};

			// Hide the shortcuts if we are adding a waypoint 
			$('.panel.journeyplanner.search').on('click', 'a.addWaypoint', function(e) {
				$('.shortcuts').hide();
				cyclestreetsui.fitMap();
			});

			// Handler for find routes button
			$('.panel.journeyplanner.search #getRoutes').click (function () {
				// Do not proceeed if we do not have enough waypoints
				if (routing.getWaypoints().length < 2) {
					return false;
				}

				// Save the search in cookie
				cyclestreetsui.addToRecentJourneys ();
				
				// Get routes from waypoints already on the map
				routing.plannable (); // Will plan the route and create the result tabs

				// Switch to the card containing the tabs
				cyclestreetsui.switchPanel ('.panel.journeyplanner.search', '.panel.journeyplanner.select');

				// Resize map element
				cyclestreetsui.fitMap ('.panel.journeyplanner.select');

			});

			// Handler for shortcut icons
			$('.panel.journeyplanner.search .shortcut-icons').click (function () {
				
				// Did we click a saved shortcut location, or a POI?
				var link = $(event.target).closest ('a');
				var shortcutLocationName = false;
				$.each(_shortcutLocations, function (indexInArray, locationName) { 
					if ($(link).hasClass (locationName)) {
						shortcutLocationName = locationName;
					}
				});

				// If we clicked on a shortcut location which is ntot set, display an alert
				var savedLocation = cyclestreetsui.retrieveSavedLocations ().find (obj => obj.title == shortcutLocationName);
				if (!savedLocation) {
					cyclestreetsui.displayNotification ("You can set your " + shortcutLocationName + " location in Settings.", '/images/icon-' + shortcutLocationName + '.svg');
				}
				

			});
			
			// Open the Route search box on focusing or clicking on any JP geocoder input
			$('.panel.journeyplanner.search input').focus (openJourneyPlannerCard);
			$('.panel.journeyplanner.search input').click ( function () {
				$(this).focus ();
			});
			
		},


		// Handler to open the journey planner card
		openJourneyPlannerCard: function() 
		{
			if (!$('.panel.journeyplanner.search').hasClass ('open')) {
				// Close all other search boxes, menus, etc...
				cyclestreetsui.resetUI ();

				// Expand card, and resize map
				$('.panel.journeyplanner.search').addClass ('open', 500);
				
				// Drop a pin in the middle of the map as our default start position
				routing.addMapCenter ();

				// Show the get routes button 
				// #¡# This should be shown only when waypoints.length > 2
				$('.panel.journeyplanner.search #getRoutes').show ({duration: 500});

				// Show the other input boxes
				$('.panel.journeyplanner.search input').show ({duration: 500});

				// Change the search placeholder to prompt user input
				$('.panel.journeyplanner.search #end').attr ('placeholder', 'Where do you want to go?');
			}
		},


		// Function to read the recent journeys stored in a cookie, and populate the search panel
		buildRecentJourneys: function () 
		{
			// Read the recent journeys from a cookie, or initialise a new array if none are saved
			_recentJourneys = ($.cookie ('recentJourneys') ? $.parseJSON($.cookie('recentJourneys')) : []);

			// Construct HTML for each journey
			var html = '';
			if (_recentJourneys.length) { // If there are recent journeys
				$.each (_recentJourneys, function (index, journeyObject) { 
					html += '<li class="getRecentJourneyDirections"><a href="#" title="Get directions to here"><img src="/images/btn-get-directions-small.svg" alt="Arrow pointing to the right" /></a>';
					html += '<p class="destination">' + journeyObject.destination + '</p>';
					html += '<p class="distance">7 miles</p>';
					html += '<p class="address">from ' + journeyObject.origin + '</p>';
					html += '</li><hr />';
				});
			} else {
				html += '<li><p class="address">Your recent journeys will appear here.</p></li>';
			}
			
			// Append this to the journey search card
			$('.recent-journeys').append (html);

		},

		// Function to read the recent searches stored in a cookie, and populate the search panel
		buildRecentSearches: function () 
		{
			// Read the recent searches from a cookie, or initialise a new array if none are saved
			_recentSearches = ($.cookie ('recentSearches') ? $.parseJSON($.cookie('recenrecentSearchestJourneys')) : []);

			// Construct HTML for each search
			var html = '';
			if (_recentSearches.length) { // If there are recent journeys
				$.each (_recentJourneys, function (index, journeyObject) { 
					html += '<li class="getRecentJourneyDirections"><a href="#" title="Get directions to here"><img src="/images/btn-get-directions-small.svg" alt="Arrow pointing to the right" /></a>';
					html += '<p class="destination">' + journeyObject.destination + '</p>';
					html += '<p class="distance">7 miles</p>';
					html += '<p class="address">from ' + journeyObject.origin + '</p>';
					html += '</li><hr />';
				});
			} else {
				html += '<li><p class="address">Your recent searches will appear here.</p></li>';
			}
			
			// Append this to the journey search card
			$('.recent-searches').append (html);

		},


		addToRecentJourneys: function ()
		{
			// Read the recent journeys from a cookie, or initialise a new array if none are saved
			_recentJourneys = ($.cookie ('recentJourneys') ? $.parseJSON($.cookie('recentJourneys')) : []);
			
			// Find the first and last input values, which contains the geocoded destination
			var origin = $('.panel.journeyplanner.search input').first().val();
			var destination = $('.panel.journeyplanner.search input').last().val();
			var waypoints = routing.getWaypoints ();

			// Build the journey object
			var journey = 
			{
				'origin': origin,
				'destination': destination,
				'waypoints': waypoints
			}

			// Add this to the _recentJourneys array, and update the cookie
			_recentJourneys.push (journey);
			$.cookie('recentJourneys', JSON.stringify(_recentJourneys));
		},
		
			
		// Close the route search box
		closeRouteSearchBox: function() {$('.panel.journeyplanner.search').removeClass ('open');},
			
		
		/*
		 * Main UI functions
		 */
		mainUI: function ()
		{
			
			// Swiping down on a card closes it
			/*
			$('.panel').on('swipedown', function () {
				cyclestreetsui.returnHome ();
			});
			*/
			
			// Swiping up on a card opens it
			$('.panel').on('swipeup', function (event) {
				// If this is the JP card, trigger open event
				if ($(event.target).is ('.panel, .journeyplanner, .search')) {
					cyclestreetsui.openJourneyPlannerCard ();
				} else {
					$(this).addClass ('open');
				}
			});

			// Generic handler for back actions
			$('.action.back').click (function () {
				// Follow any directly specified href
				var href = $(this).attr ('href');
				if (href != '#') {
					// Get the current panel class name
					var currentPanel = $(this).closest ('.panel').attr ('class');
					currentPanel = '.' + currentPanel.replace (/\s/g, '.');
					
					// Build a class name out of the href
					href = href.replace (/^#/, '.');
					
					// Switch panels
					cyclestreetsui.switchPanel (currentPanel, href);
				} 
				else {
					// If we have stored a previous breadcrump, return to it
					if (_breadcrumbs.length > 0) {
						// Hide all panels
						$('.panel').hide ();
						
						// Show the previous panel
						var lastPanel = _breadcrumbs.pop ();
						$(lastPanel).first ().show ();

					}
					else {
						// Otherwise, if there are no breadcrumbs, return to the default home screen
						cyclestreetsui.returnHome ();	
					}

					// Resize map element
					cyclestreetsui.fitMap ();
					
				}
			});
			
			// Generic action to return home clicking cancel button
			$('.returnHome').click (function () {cyclestreetsui.returnHome ();});
			
			// Generic action to start a wizard
			$('.start-wizard').click (function () {
				
				// Get current panel name and deduce the wizard name from the class name
				var closestPanel = $(this).closest ('.panel').attr ('class'); // i.e., 'panel photomap'
				var panelClass = closestPanel.split (' '); // Split the current panel, i.e. [panel, photomap]
				var wizardClass = cyclestreetsui.removeFromArray (panelClass, 'panel');
				wizardClass = '.wizard' + '.' + wizardClass; // i.e., '.wizard.photomap'
				
				// Locate the first panel of this wizard
				var firstWizardPanel = $(wizardClass).find ('.panel').first ();
				
				// Switch panel, and add the current panel to the breadcrumb trail
				closestPanel = closestPanel.replace (/\s/g, '.');
				cyclestreetsui.switchPanel ('.' + closestPanel, firstWizardPanel);
			});
			
			// Move forward in a wizard
			$('.action.forward').click (function() {
				
				// Did we click inside a wizard?
				var wizard = $(this).closest ('.wizard');
				if (wizard.length) {
					
					// Get current panel name and convert spaces into dots
					var currentPanel = $(this).closest ('.panel').attr ('class');
					currentPanel = currentPanel.replace (/\s/g, '.');
					
					// Get the panel class we are in, without sub-panel
					var panelClass = currentPanel.split ('.'); // Split the current panel, i.e. [panel, photomap, add-photo]
					panelClass.pop(); // Pop the sub-panel out of the array
					panelClass = panelClass.join ('.'); // Reconstruct the string from array, i.e panel.photomap
					panelClass = '.' + panelClass; // Add the leading dot, i.e. .panel.photomap
					
					// Find the next children of this panel
					var nextPanel = $(this).closest ('.panel').next (panelClass);
					var nextPanelClass = '.' + nextPanel.attr ('class').replace (/\s/g, '.');
					
					// Check whether we can progress
					if (!cyclestreetsui.canProgress ('.' + currentPanel)) {
						return;
					}
					// Switch the panel
					cyclestreetsui.switchPanel ('.' + currentPanel, nextPanelClass);
				}
				
			});
			
			// On every click inside a wizard, check to see if we can progress
			$('.wizard .panel').click (function () {
				cyclestreetsui.enableNavigation (this);
			});
			
			// On every click inside a wizard, check to see if we can progress
			$('.wizard .panel').keydown (function () {
				cyclestreetsui.enableNavigation (this);
			});
			
			 $('input:file').change(function (){
				cyclestreetsui.enableNavigation (this);
			 });
			
			// Show the move-map-to search box
			$('#glasses-icon').click (function() {
				cyclestreetsui.resetUI ();
				cyclestreetsui.openBrowseSearchBar ();
			});
			
			// Close the Browse search box
			$('#close-browse-box-icon').click (cyclestreetsui.hideBrowseSearchBox);
			
			// Slide up the ride notification on click
			$('.notification').click (function () {
				// If there is a queue of 'fx', we dequeue the current notification immediately, rather than waiting for the delay
				$('.notification').dequeue ();
				$('.notification').slideUp ('slow');
			});

			// Activate segmented controls, i.e., when a list item is clicked, activate it and deactivate all other list items
			$('.segmented-control li').click (function (){
				$(this).addClass ('active');
				$(this).siblings ('li').removeClass ('active');
			});

			// Save all the inputs as cookies
			$('.save').click (function (event) {
				// Find closest data input types in this panel
				var currentPanel = $(event.target).closest ('.panel');
				var nearestInputs = [];
				var inputTypes = ['input', 'select', 'range', 'textarea', 'textfield', '.segmented-control li.active']; // Add other types
				$.each(inputTypes, function (index, type) {
					// Find all inputs of this type
					var closestInputs = $(currentPanel).find (type);
					
					// If any were found, add this to the nearestInputs array
					if (closestInputs.length) {
						$.each(closestInputs, function (index, input) {
							nearestInputs.push (input);
						});
					}
				});

				// Save each value in the cookie
				$.each(nearestInputs, function (index, input) {
					if ($(input).attr('type') == 'checkbox') {
						$.cookie($(input).attr('id'), $(input).prop('checked'));
					} else if ($(input).is ('li')) {
						var segmentedControlId = $(input).parent().prop('id');
						$.cookie(segmentedControlId, $(input).prop('id'));
					} else {
						$.cookie($(input).attr('id'), $(input).val());
					}
				});
			})

			// On startup, load any input values from cookies
			$.each($.cookie(), function (inputId, value){
				if ($('#' + inputId).attr('type') == 'checkbox') {
					$('#' + inputId).prop('checked', value == 'true');
				} else if ($('#' + inputId).hasClass ('segmented-control')) {
					$('#' + inputId).children ('li').removeClass ('active'); // Disable any default settings
					$('#' + value).addClass ('active'); // Add active class to the saved <li> item
				} else {
					$('#' + inputId).val(value);
				}
			});
		},


		// Function to open the browse search bar (move map to)
		openBrowseSearchBar: function ()
		{	
			$('#browse-search-box').show ();
			$('#browse-search-box').addClass ('open');
			$('#close-browse-box-icon').show ();
			$('#glasses-icon').hide ();
			$('#browse-search-box').animate ({width: '70%',}, "slow");
			$('#browse-search-box').focus ();
		},
		
		// Enable wizard navigation
		enableNavigation: function (element) {
			// Get current panel name and convert spaces into dots
			var currentPanel = $(element).closest ('.panel').attr ('class');
			currentPanel = currentPanel.replace (/\s/g, '.');
			
			var canProgress = cyclestreetsui.canProgress ('.' + currentPanel);
			$('.' + currentPanel + ' .action.forward').toggleClass ('enabled', canProgress);	
		},
		
		// Determine whether any form item within the selector has been filled
		canProgress: function (selector)
		{
			// Find closest data input types in this panel
			var nearestInputs = [];
			var inputTypes = ['input', 'select', 'textarea', 'textfield']; // Add other types
			$.each(inputTypes, function (index, type) {
				// Find all inputs of this type
				var closestInputs = $(selector).find (type);
				
				// If any were found, add this to the nearestInputs array
				if (closestInputs.length) {nearestInputs.push (closestInputs);}
			});
			
			// If any of these have not been filled out, can not progress
			var canProgress = true; // Default action is to progress
			$.each(nearestInputs, function (index, input) {
				var value = $(input).val ();
				if (!value) {canProgress = false;}
			});
			
			return canProgress;
		},
		
		// Hide the move-map-to search box
		hideBrowseSearchBox: function()
		{
			$('#browse-search-box').width ('50px');
			$('#glasses-icon').show ();
			$('#close-browse-box-icon').hide ();
			$('#browse-search-box').removeClass ('open');
			$('#browse-search-box').hide ();
		},
		
		// Switch panel
		switchPanel: function (currentPanel, destinationPanel) {
			_breadcrumbs.push (currentPanel);
			$(currentPanel).hide ();
			$(destinationPanel).show ();

			// Resize map element
			cyclestreetsui.fitMap (destinationPanel);
		},
		
		// Reset nav and move-map search box to their default states
		resetUI: function () {
			// Close the nav bar
			cyclestreetsui.closeNav ();
			
			// Reset the route search box to default "peeking" height
			cyclestreetsui.closeRouteSearchBox ();
			
			// Hide the move-map browse input field
			cyclestreetsui.hideBrowseSearchBox ();
		},
		
		// Set-up the default home-screen
		returnHome: function () {
			cyclestreetsui.resetUI ();
			$('.panel').hide (); // Hide all panels
			$('.panel.journeyplanner.search').show (); // Show the default pannel, i.e. journeyplanner search
			
			// Resize map element
			cyclestreetsui.fitMap ();
		},
			
			
		/*
		 * Ride tracker actions
		 */
		rideTracker: function ()
		{
			// Main ridetracker panel actions
			$('.panel.ridetracker.track .action.forward').click (function () {
				if ($('.panel.ridetracker').hasClass ('tracking')) {
						// Reset the ride tracking panel to default state
						$('.panel.ridetracker.track').hide ();
						$('.panel.ridetracker.track').removeClass ('tracking');
						$('#cancel-tracking, #finish-tracking').removeClass ('enabled');
						$('#my-rides-button, #start-ride-tracking').addClass ('enabled');
						
						
						// Open the add-details panel
						cyclestreetsui.switchPanel ('.panel.ridetracker.track', '.panel.ridetracker.add-details');
					}
				else {
						// Add breadcrumb to enable the back chevron functionality
						_breadcrumbs.push ('.panel.ridetracker.track');
						
						// Add tracking classes to adjust the appearance of this panel to satnav-mode
						$('.panel.ridetracker.track').addClass ('tracking');
						$('#my-rides-button, #start-ride-tracking').removeClass ('enabled');
						$('#cancel-tracking, #finish-tracking'). addClass('enabled');
					}
			});
			
			$('.panel.ridetracker.track .action.back').click (function () {
				// If we are in satnav mode, cancel the tracking and return to default state
				if ($('.panel.ridetracker.track').hasClass ('tracking')) {
						$('.panel.ridetracker.track').removeClass ('tracking');
						$('#cancel-tracking, #finish-tracking').removeClass ('enabled');
						$('#my-rides-button, #start-ride-tracking').addClass ('enabled');
					}
				// Otherwise, open the My Rides panel
				else {
						//cyclestreetsui.switchPanel ('.panel.ridetracker.track', '.panel.ridetracker.my-rides');
					}
			});
			
			
			$('.panel.ridetracker.add-details .action.forward').click (function () {
				cyclestreetsui.switchPanel ('.panel.ridetracker.add-details', '.panel.ridetracker.show-tracked-ride');
			});
			
			// Enable the share sheet 
			$('.panel.ridetracker.show-tracked-ride .action.forward').click (function () {
				const shareData = {
					title: 'My CycleStreets Journey',
					text: 'View my latest journey here!',
					url: 'https://www.cyclestreets.net/journey/52327060/'
				};
				navigator.share (shareData);
			});
		},
		

		/*
		 * POIS selection screen actions
		 */
		pois: function ()
		{	
			// At startup, retrieve the POIS from cookie or set as defaults
			cyclestreetsui.retrievePoisCookie ();
			
			// On clicking a POI, save the new POI selection to a cookie
			// Also, deselect all other POIs (workaround until API supports multiple types)
			$('.panel.pois input').click (function () {
				// What POI did we click on?	
				var clickedPoiId = $(this).attr('id');

				// If this is the last POI selected, leave it on
				if($.inArray(clickedPoiId, _poisActivated) !== -1) {
					return false;
				}
				
				// If any other POIS are selected, deselect these			
				$.each($('.panel.pois input:checked'), function (index, input) {
					if (input.id != clickedPoiId) {
						$(input).prop('checked', false);
					}
				});

				// Update the POIs cookie
				cyclestreetsui.updatePoisCookie ();
			});

		},

		
		// Function to read the POIs currently selected, and save them to a cookie
		updatePoisCookie: function ()
		{	
			// Find the first and last input values, which contains the geocoded destination
			var poisActivated = $('.panel.pois input:checked');	

			// Rebuild the cookie storage object
			_poisActivated = []; 
			$.each($(poisActivated), function (index, input) {
				_poisActivated.push($(input).prop('id'));
			});


			// Overwrite the POIS cookie and update the class variable
			$.cookie('poisActivated', JSON.stringify(_poisActivated));
		},

		
		// Function to retrieve the POIs cookie and update the POIs card
		retrievePoisCookie: function ()
		{
			// Read the recent journeys from a cookie, or read the default array if no cookie present
			var poisActivated = ($.cookie ('poisActivated') ? $.parseJSON($.cookie('poisActivated')) : _settings['defaultPoi']);
			
			// Loop through each POI ID and check the checkbox
			$.each($(poisActivated), function (index, poiID) {
				$('#' + poiID).attr("checked", true);
				_poisActivated.push(poiID);
			});

			// Write this to the class variable
		},

			
		/*
		 * Settings, about and map-styles
		 */
		settings: function ()
		{
			// Open about card
			$('#about-cyclestreets').click (function () {
				cyclestreetsui.switchPanel ('.panel.settings', '.panel.about');
			});

			// On startup, retrieve any saved frequent locations from the cookie
			cyclestreetsui.retrieveSavedLocations ();

			// On startup, retrieve the latest blog post, and cross-check against saved cookie
			cyclestreetsui.checkLatestBlogPost ();

			// When setting a saved location, open a card with a geocoder
			$('.setSavedLocation').click (function () {
				// Set single marker mode
				routing.setSingleMarkerMode (true);
				
				// Divine the type of location we are setting
				_settingLocationName = this.id.replace('Location', ''); // i.e., 'home'
				
				// Update the text on the find location panel, and switch to it
				$('.panel.journeyplanner.setLocation').find('h2').first().text ('Set your ' + _settingLocationName + ' location');
				cyclestreetsui.switchPanel ('.panel.settings', '.panel.journeyplanner.setLocation');

				// Change the browse search bar placeholder and open it
				$('#browse-search-box').val('');
				$('#browse-search-box').attr ('placeholder', 'Search or click the map to set a location');
				cyclestreetsui.openBrowseSearchBar ();
			});

			// After clicking save, save the frequent location
			$('.panel.journeyplanner.setLocation a.action.forward').click (function () {
				
				// Hide the browse search box and reset the placeholder
				cyclestreetsui.hideBrowseSearchBox ();
				$('#browse-search-box').attr ('placeholder', 'Move map to place or postcode');

				// Get the saved marker location
				var singleMarkerLocation = routing.getSingleMarkerLocation ();
				var reverseGeocodedLocation = $('.panel.journeyplanner.setLocation input').first().val();

				// Assemble the cookie object
				var cookieObject = {
					'title': _settingLocationName,
					'coordinates': singleMarkerLocation,
					'address': reverseGeocodedLocation
				};
				
				// Update the location cookie, and also the settings card
				cyclestreetsui.updateSettingsSavedLocations (cookieObject);

				// Turn off singleMarkerMode #¡# Any clicking out of this mode should disable it automatically
				routing.setSingleMarkerMode (false);
				
				// Switch back to settings
				cyclestreetsui.switchPanel ('.panel.journeyplanner.setLocation', '.panel.settings');
			});


			// When clicking cancel, exit singleMarkerMode
			$('.panel.journeyplanner.setLocation a.action.back').click (function () {
				// Turn off singleMarkerMode #¡# Any clicking out of this mode should disable it automatically
				routing.setSingleMarkerMode (false);

				// Reset the browse search bar placeholder and close it
				cyclestreetsui.hideBrowseSearchBox ();
				$('#browse-search-box').attr ('placeholder', 'Move map to place or postcode');
			});
		},

		// Function to find the latest blog post, and alert the user of its existence
		checkLatestBlogPost: function ()
		{		
			$.ajax({
				url: 'https://www.cyclestreets.org/wp-json/wp/v2/posts',
				type: 'GET'
			}).done (function (result) {
				// Get the latest viewed blog post ID from coookie
				var lastViewedBlogPostId = ($.cookie ('lastViewedBlogPostId') ? $.parseJSON($.cookie('lastViewedBlogPostId')) : false);

				// Find this ID in the result array
				var newBlogPostCount = 0;
				if (lastViewedBlogPostId) {
					var lastViewedBlogPostIndex = result.findIndex(blogPost =>blogPost.id == lastViewedBlogPostId);
					if (markerIndex == 0) {
						// We have seen the latest blog post
						return;
					} else if (markerIndex > -1) {
						// The amount of new blog posts is equal to our marker index
						newBlogPostCount = markerIndex
					} else { // i.e., could not find this ID
						// Otherwise, there are 10 new blog posts (the API retrieval limit)
						newBlogPostCount = 10;
					}					
				} else {newBlogPostCount = 10;}

				// Display a notification
				var notificationText = 'There are ' + newBlogPostCount + ((newBlogPostCount == 1) ? ' new blog post.': ' new blog posts.');
				cyclestreetsui.displayNotification (notificationText, '/images/icon-hashtag.svg')

			});	
		},

		// Function to set the latest blog post as the most recently viewed post
		setMostRecentBlogPostAsViewed: function ()
		{
			$.ajax({
				url: 'https://www.cyclestreets.org/wp-json/wp/v2/posts',
				type: 'GET'
			}).done (function (result) {
				var latestBlogPostId = result.shift ().id;
				$.cookie('lastViewedBlogPostId', JSON.stringify(latestBlogPostId));
			});
		},

		// Function to update saved locations (home, work) in Settings panel
		updateSettingsSavedLocations: function (cookieObject)
		{
			// Retrieve the savedLocations cookie and parse it
			var savedLocations = ($.cookie ('savedLocations') ? $.parseJSON($.cookie('savedLocations')) : []);

			// Search through the locations, and if we already have this location, update it
			var updatedLocation = false;
			$.each(savedLocations, function (indexInArray, savedLocation) { 	
				if (savedLocation.title == cookieObject.title) {
					 savedLocations[indexInArray] = cookieObject;
					 updatedLocation = true;
				}
			});

			// As we didn't have this location saved, add it as a new location
			if (!updatedLocation) {
				savedLocations.push (cookieObject);
			}
			
			// Store the savedLocations array as a cookie
			$.cookie('savedLocations', JSON.stringify(savedLocations));

			// Update the labels in the app
			cyclestreetsui.retrieveSavedLocations ();
		},


		// Function to search cookies for saved work/home locations, and update the settings card with the locations
		retrieveSavedLocations: function ()
		{
			// Read the saved locations from a cookie, or initialise a new array if none are saved
			var savedLocations = ($.cookie ('savedLocations') ? $.parseJSON($.cookie('savedLocations')) : []);
			
			// Find and update any locations we need for the settings panel
			var savedLocation = null;
			var elementId = null;
			$.each(_shortcutLocations, function (indexInArray, locationName) { 
				savedLocation = savedLocations.find (obj => obj.title == locationName);

				// If we found a saved location, locate that label and update it in the settings panel
				if (savedLocation) {
					// Update the label on the button
					elementId = locationName + 'Location';
					var text = savedLocation.address;
					var buttonElement = $('#' + elementId).find ('a').first ();
					buttonElement.text (text);

					// Also add class 'set' to change button colour
					buttonElement.addClass ('set');

					// Enable the corresponding item in the Journey Planner card
					$('.shortcut-icons a.' + locationName).removeClass ('disabled');
				}
			});

			return savedLocations;
		},


		// Getter for settingLocationName, used to define which frequent location we are in the process of setting
		getSettingLocationName: function ()
		{
			return _settingLocationName;
		},


		/*
		 * Log-in and sign-up
		 */
		loginAndSignup: function ()
		{
			// On launch, log the user in if we find a cookie
			cyclestreetsui.updateLoggedInStatus ();

			// Enable masking/unmasking of password fields
			$('.showOrHidePassword').click (function () {
				this.previousElementSibling.type = $(this).hasClass ('show') ? 'text' : 'password';
				$(this).toggleClass ('show');
				$(this).attr ('src', $(this).hasClass ('show') ? '/images/icon-eye.svg' : '/images/icon-eye-false.svg');
			});
			
			// Upon typing into a password field, reveal the showOrHidePassword eye icon
			$('input[name="password').on ('input', function (event) {
				// Which panel is this (i.e. log-in, sign-up)
				var panel = $(event.target).closest ('.panel');
				var passwordMaskImage = $(panel).find ('.showOrHidePassword').first ();
				// If we can't find a password mask image, return
				if (!passwordMaskImage) {return;}

				// On this panel, if there is any input in the password field, show the ucon
				if ($(event.target).val().length) {
					$(passwordMaskImage).show ();
				} else {
					$(passwordMaskImage).hide ();
				}
			});
			
			// Sign-in handler
			$('.panel.account a.action.forward').click (function() {

				// Switch to log-in panel
				cyclestreetsui.switchPanel ('.panel', '.panel.creating-account');
				$('.panel.creating-account p').text ('Logging in...');
				
				// Build the authentication URL
				var userAuthenticationUrl = layerviewer.settingsPlaceholderSubstitution(_settings.userAuthenticationUrl, ['apiBaseUrl', 'apiKey']);

				// Locate the form
				var loginDetails = $('.panel.account form');

				// Send the log-in data via AJAX
				$.ajax({
					url: userAuthenticationUrl,
					type: loginDetails.attr('method'),
					data: loginDetails.serialize()
				}).done(function (result) 
				{	
					// Detect API error
					if ('error' in result) {
						$('.feedback-submit.error p').text(result.error);
						cyclestreetsui.switchPanel('.panel', '.feedback-submit.error');

					} else { // Save the login cookie
						// Switch to the logging in panel
						cyclestreetsui.switchPanel ('.panel', '.panel.logged-in');

						// Encode the credentials in base 64
						var identifier = btoa(unescape(encodeURIComponent($('.panel.account input[name ="identifier"]').val())));
						var password = btoa(unescape(encodeURIComponent($('.panel.account input[name ="password"]').val())));
						
						var credentials = {
							'identifier': identifier,
							'password': password
						}; 

						// Update the login status
						cyclestreetsui.updateLoggedInStatus (credentials);
					}

				}).fail(function (failure) {
					if (failure.responseJSON.error) {
						$('.feedback-submit.error p').text(failure.responseJSON.error);
					}
					cyclestreetsui.switchPanel('.panel', '.feedback-submit.error');
				});

				// Remove the password from the log-in card
				$('.panel.account input[name="password"]').val ('');
				
			});


			// Sign-up handler
			$('.wizard.account .panel.choose-password a.action.forward').click (function() {

				// Switch to creating account panel
				$('.panel.creating-account p').text ('Creating your account...');
				cyclestreetsui.switchPanel ('.panel', '.panel.creating-account');
				
				// Build the authentication URL
				var accountCreationUrl = layerviewer.settingsPlaceholderSubstitution(_settings.accountCreationUrl, ['apiBaseUrl', 'apiKey']);

				// Locate the form
				var accountDetails = $('.wizard.account form');

				// Send the log-in data via AJAX
				$.ajax({
					url: accountCreationUrl,
					type: accountDetails.attr('method'),
					data: accountDetails.serialize()
				}).done(function (result) 
				{	
					// Detect API error
					if ('error' in result) {
						// Is this a username or password error? Based on error message, write the correct card to the breadcrumb trail
						var returnToWhichPanel = null;
						if (~result.error.indexOf('username')) {
							returnToWhichPanel = '.panel.choose-username';
						} else {
							returnToWhichPanel= '.panel.choose-password';
						}
						
						// Display the error panel with error message
						$('.feedback-submit.error p').text(result.error);
						$('.panel').hide (); // Workaround so that the back button goes back to the correct panel
						cyclestreetsui.switchPanel(returnToWhichPanel, '.feedback-submit.error');

					} else { // Display success message
						cyclestreetsui.switchPanel ('.panel', '.panel.logged-in');
						$('.panel.logged-in p').text (result.successmessage);

						// Prefill the log-in page with the user registration username
						var username = $('.panel.choose-username input[name="username"]').val();
						$('.panel.account input[name="identifier"]').val (username);

						// Blank all the user registration wizard inputs
						$('.wizard.account input').val ('');
					}

				}).fail(function (failure) {
					if (failure.responseJSON.error) {
						$('.feedback-submit.error p').text(failure.responseJSON.error);
					}
					cyclestreetsui.switchPanel('.panel', '.feedback-submit.error');
				});

				// Remove the password from the sign-up card
				$('input[name="password"]').val ('');
				
			});


			// Clicking Recover Password switches to that card
			$('.forgottenPassword').click (function () {
				cyclestreetsui.switchPanel ('.panel.account', '.panel.reset-password');
			});
			
			// Password recovery handler
			$('.panel.reset-password a.action.forward').click (function() 
			{	
				// Locate the form
				var accountDetails = $('.panel.reset-password input[name="email"]');

				// Send the log-in data via AJAX
				$.ajax({
					url: _settings.passwordResetUrl,
					type: 'POST',
					data: accountDetails.serialize()
				});

				// Display a dropdown, indicating the reset email has been requested
				cyclestreetsui.resetUI ();
				cyclestreetsui.displayNotification ("We've sent an email with recovery instructions.", '/images/tick-green.png');

				// Blank the input field
				$('.panel.reset-password input').val ('');
			});
		},


		// Function to update log-in status. Optionally accepts an object with credentials
		// On receiving a credentials object, these are stored to a cookie and the app state is updated to reflect logged-in status
		// Without arguments, will check for stored cookie, and update the user status/interface
		updateLoggedInStatus: function (credentials = false)
		{
			// If we are receiving credentials
			if (credentials) {
				// Store the new credentials in the cookie
				$.cookie('credentials', JSON.stringify(credentials));
			}

			// Update navbar
			if ($.cookie('credentials')) {
				$('nav li.account a').text ('Sign out');
				$('nav li.account').addClass ('signOut');
			} else {
				$('nav li.account a').text ('Sign in');
				$('nav li.account').removeClass ('signOut');
			}
		},


		// Function to sign a user out
		signOut: function () 
		{
			// Delete the credentials cookie
			$.removeCookie('credentials');
			
			// Update the status of the nav bar
			cyclestreetsui.updateLoggedInStatus ();

			// Remove the password from the log-in card
			$('.panel.account input[name="password"]').val ('');

			// Display a dropdown, indicating the user has signed out
			cyclestreetsui.resetUI ();
			cyclestreetsui.displayNotification ('You have logged out.', '/images/tick-green.png');
		},

			
		/*
		 * Popup actions
		 */
		popupActions: function ()
		{
			// Close a popup panel
			$('.popup .close-button').click (function() {
				$('.popup').hide('300');
			});
			
			// Flip photomap popup card
			$('.popup a.flip').click (function () {
				$('.inner-card').addClass('flipped');
			});
			$('.popup a.back').click (function () {
				$('.inner-card').removeClass('flipped');
			});
			
			// Start navigation from a places popup card
			$('.popup .get-directions').click (function () {
				cyclestreetsui.switchPanel ('.popup.places', '.panel.journeyplanner.select');
			});
		},	

		
		// Display a notification popup with a message 
		displayNotification: function (notificationText, imageSrc) 
		{
			
			// Add this notification to the queue
			_notificationQueue.push ({'notificationText': notificationText, 'imageSrc': imageSrc});
			
			// If the display daemon is already working through a queue, let it do its job
			if ($('.popup.system-notification').queue ('fx').length) {
				return;
			} else {
				// Otherwise start to work through the notification queue
				cyclestreetsui.notificationDaemon ();
			}
			
		},


		// Function to work through a queue of notifications. Will exit after the last notification is shown
		notificationDaemon: function ()
		{
			// If there are items in the queue that haven't been displayed
			var notification = null;
			if (_notificationQueue.length) {
				
				// Pop the array
				notification = _notificationQueue.shift ();
				
				// Set the image and text
				$('.popup.system-notification img').attr('src', notification.imageSrc);
				$('.popup.system-notification p.direction').text (notification.notificationText);

				// Slide down the notification, and hide it after a delay
				// Upon completetion, call this function again
				$('.popup.system-notification').slideDown('slow');
				$('.popup.system-notification').delay(2500).slideUp('slow', cyclestreetsui.notificationDaemon);
			} 
				
		},
			
		
		/*
		 * Utilities
		 */
		removeFromArray: function (myArray, removeItem)
		{
			myArray.splice ($.inArray (removeItem, myArray), 1);
			return myArray;
		},
		

		/*
		 * Developer tools
		 */
		developerTools: function ()
		{
			
			//$('.panel').hide ();
			//$('.popup.photomap').show ();
			//$('.panel.journeyplanner.select').show ();
			//$('#tabs').tabs();
			//console.log($('.popup.photomap').prop('outerHTML'));
		}
		
	};	
} (jQuery));
