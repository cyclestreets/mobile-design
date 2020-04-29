var cyclestreetsui = (function ($) {
	
	'use strict';
	
	// Settings defaults
	var _settings = {
		
		// API
		apiBaseUrl: 'API_BASE_URL',
		apiKey: 'YOUR_API_KEY',
		
		// Mapbox API key
		mapboxAccessToken: 'MAPBOX_ACCESS_TOKEN',
		
		// Initial lat/lon/zoom of map and tile layer
		defaultLocation: {
			latitude: 54.661,
			longitude: 1.263,
			zoom: 6
		},
		maxBounds: null,	// Or [W,S,E,N]
		defaultTileLayer: 'mapnik',
		maxZoom: 20
	};
	
	
	// Internal class properties
	var _map = null;
	
	
	return {
		
		// Main function
		initialise: function (config)
		{
			// Merge the configuration into the settings
			$.each (_settings, function (setting, value) {
				if (config.hasOwnProperty(setting)) {
					_settings[setting] = config[setting];
				}
			});
			
			cyclestreetsui.createMap ('map');
			cyclestreetsui.createMap ('mini-map');
			cyclestreetsui.createUIEvents();
		},
		
		
		// Create the map
		createMap: function (container)
		{
			// Create the map in the "map" div, set the view to a given place and zoom
			mapboxgl.accessToken = _settings.mapboxAccessToken;
			_map = new mapboxgl.Map({
				container: container,
				style: 'mapbox://styles/mapbox/light-v9',
				center: [_settings.defaultLocation.longitude, _settings.defaultLocation.latitude],
				zoom: _settings.defaultLocation.zoom
			});
			
			//_map.addControl (new mapboxgl.NavigationControl (), 'top-left'); can this be positioned elsewhere?
		},
		
		
		// Setup nav events
		createUIEvents: function ()
		{
			/* Nav bar functions */
			// Open the nav bar
			$('#hamburger-menu').click(function() {$('nav').addClass('open');});
			
			// Close the nav bar
			var closeNav = function() {$('nav').removeClass('open');};
			
			// Enable implicit click/touch on map as close menu
			if ($('nav').is(':visible')) {$('#map').click(function () {resetUI ();});}
			
			// Enable swipe-to-close
			$('nav').on('swipeleft', function () {$('nav').removeClass('open');});
			
			// Open the Data submenu
			$('li.data').click(function() {$('li.data ul').slideToggle();});
			
			// Open the route search box
			var routeSearchBoxFocus = function() {
				resetUI();
				$('#route-search-box, #route-search-panel').addClass( 'open' );
				$('#shortcut-icons, #journey-options').addClass ('visible');
				
			};
			
			// Make route browser div dragable
			$('#route-search-panel').draggable ({
				axis: "y",
				refreshPositions: true,
				grid: [ 50, 350 ],
				drag: function () {
					routeSearchBoxFocus ();
				}
			});
			
			
			/* Main UI functions */
			// Reset the UI to its default state
			var resetUI = function () {
				closeNav ();
				hideBrowseSearchBox ();
				closeRouteSearchBox ();
				$('#creating-account-panel').hide();
			};
			
			// Show the Browse search box
			$('#glasses-icon').click(function() {
				resetUI ();
				$('#browse-search-box').show();
				$('#browse-search-box').addClass( 'open' );
				$('#close-browse-box-icon').show();
				$('#glasses-icon').hide();
				$('#browse-search-box').animate({width: '80%',}, "slow");
				$('#browse-search-box').focus();
			});
			
			// Hide the Browse search box
			var hideBrowseSearchBox = function() {
				$('#browse-search-box').width('50px');
				$('#glasses-icon').show();
				$('#close-browse-box-icon').hide();
				$('#browse-search-box').removeClass( 'open' );
				$('#browse-search-box').hide();
			};
			
			// Close the route search box
			var closeRouteSearchBox = function() {
				$('#route-search-panel, #route-search-box').removeClass( 'open' );
				$('#shortcut-icons, #journey-options').removeClass ('visible');
				
			};	
			
			// Close the Browse search box
			$('#close-browse-box-icon').click(hideBrowseSearchBox);
			
			// Open the Route search box
			$('#route-search-box').focus(routeSearchBoxFocus);
			
			// Development "tour" actions
			$('#photomap-add-button').click(function() {				
				$('#photomap-panel').hide();
				$('#photomap-add-location-panel').show();
			});
			$('#photomap-add-location-continue').click(function() {				
				$('#photomap-add-location-panel').hide();
				$('#photomap-add-details-panel').show();
			});
			$('#photomap-upload').click(function() {				
				$('#photomap-add-details-panel').hide();
				$('#photomap-uploading-panel').show();
			});
			$('#cancel-photomap-upload').click(function() {				
				$('#photomap-uploading-panel').hide();
				$('#route-search-panel').show();
			});
			
			// Display photomap
			$('#photomap').click( function() {
				closeNav ();
				$('#route-search-panel').hide();
				$('#photomap-panel').show();
			});
			
			// Hide photomap popup panel
			$('#popup-close-button').click( function() {
				$('#photomap-popup-panel').hide('300');
			});
			
			// When creating account, after inputting username, display password set card
			$('#choose-username-next').click( function (){
				$('#create-account-panel').addClass('open');
				$('#choose-username').addClass('disabled');
				$('#choose-password').removeClass('disabled');
				$('#choose-username-next').addClass('disabled');
				$('#finish-account-creation').removeClass('disabled');
			});
			
			// Hide the user information input panel, and display the creating account card
			$('#finish-account-creation').click ( function () {
				$('#create-account-panel').hide();
				$('#creating-account-panel').show();
			});
			
			// Open sign-in card
			$('#sign-in').click( function () {
				resetUI();
				$('#route-search-panel').hide();
				$('#sign-in-panel').show();
			});
			
			// Open sign-up card
			$('#create-account-button').click( function () {
				$('#sign-in-panel').hide();
				$('#create-account-panel').show();
			});
			
			
			// While developing, open the route-box on load
			//$('#route-search-panel').hide();
			//$('#sign-in-panel').show();
			
			
		}
	
	};	
} (jQuery));
