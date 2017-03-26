# Snap
Data/Handlebars Template coupler


What is Snap:

The purpose of snap is to provide an easy way to render Handlebars templates based on a data object's changing state. The template and data object must be registered with Snap using Snap.setTemplate() and Snap.setData(). These function will trigger the necessary redraws. 

How to use:

Snap connects an element->template->data->controller


1) Drop elements on page:
	<div data-tmpl="my-data"></div>

	- by default this element watches for changes in the data 'my-data'.
	- by default the controller is a generic link that watches the 'my-data' and triggers a redraw on change
	- to customize which data the element watches, set the attribute 'data-watch':
		<div data-tmpl="my-data" data-watch="custom-data"></div>


2) Add templates
	Snap.setTemplate('my-data','{{name}}');


3) Add data

	Snap.setData([KEY],[DATA],[OPTIONS]);

	KEY: reference name of data object

	DATA: new data object

	OPTIONS: tweak the update process

		- deep:true (default false): 
			true: uses $.extend(true,OLD-DATA, DATA)
			false: uses $.extend(OLD-DATA, DATA)

		- overwrite:true (default false)
			true: replace data entirely
			false: runs $.extend on the old data
	
	Usage:

	Snap.setData('my-data',{name:"My Object Name"});

	Snap.setData('my-data',{name:"My Object Name"},{overwrite:true});


Options:

1) Intialize a data set with some helpers...

	Snap.setDataConfig('my-data',{
		useLocalStorage:true, // save this locally for when user returns
		defaultValue:[], // set default value
		process:function(data){ // use pass-through function to process data when Snap.setData is called
			return $.grep(data,function(e){
				return e!==null; // example: remove nulls from array
			})
		}
	});


2) Watch data changes for making page updates
	Snap.watchData('saved-recipes',onChangeSavedRecipes);


3) Add a custom controller for elements

	
	Coming soon...
