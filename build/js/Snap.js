/*

How to use:

Snap connects an element->template->data->controller


1) Drop elements on page:
	<div data-tmpl="my-data"></div>

	- by default this element watches for changes in the data 'my-data'.
	- by default the controller is a generic link that watches the 'my-data' and triggers a redraw on change
	- to customize which data the element watches, set the attribute 'data-watch':
		<div data-tmpl="my-data" data-watch="custom-data"></div>


2) Add templates
	Snap.addTemplate('my-data','{{name}}');

3) Add data
	Snap.setData('my-data',{name:"My Object Name"});


Options:

1) Intialize a data set with some helpers...

	Snap.setDataConfig('my-data',{
		useLocalStorage:true, // save this locally for when user returns
		defaultValue:[], // set default value
		process:function(data){ // use pass-through function on save to manage data set
			return $.grep(data,function(e){
				return e!==null; // example: remove nulls from array
			})
		}
	});

2) Watch data changes for making page updates
	Snap.watchData('saved-recipes',onChangeSavedRecipes);

3) Add a custom controller for elements

	
	function CustomController(el){
		// config holds data for this piece
		var config = getElementConfig(el);

		function renderElement(data){
			config.$el.html(config.tmpl(data));
			render(config.$el);
		}

		watchData(config.dataKey,renderElement);

	}
	Snap.setController();



*/
var Snap = (function(){
	var debug = 0;
	var controls = {};
	var templates = {};
	var watchers = {};
	var datas = {};
	var dataConfig = {};
	var requestQueue = [];
	var requestStatus = 0;
	var elementIndex = 0;
	var elementRef = [];

	// this helper allow dynamic templates in Handlebars
	// great for dynamic pages/SPA style stuff
	Handlebars.registerHelper('snaptmpl', function(template, context, opts) {
		if(!template || !context) return '';
		
		// extend data with manually passed parameters
		$.extend(context,opts.hash);

		var tmpl = Handlebars.partials[template];
		//console.log('snaptmpl',template,'==',tmpl,'context',context);
	    //return tmpl ? new Handlebars.SafeString('<div data-tmpl="'+template+'">'+tmpl(context)+'</div>') : "";
	    return new Handlebars.SafeString(tmpl(context));
	});

	// internal helper
	function getAttribute($e,key,defaultValue){
		if($e[0].hasAttribute(key)){
			var attr = $e.attr(key);
			if(attr){
				return attr;
			}
		}
		return defaultValue;
	}

	// default setting
	function defaultTemplate(data){
		return JSON.stringify(data);
	}

	function defaultController(el){
		var config = getElementConfig(el);

		function renderElement(data){
			config.$el.html(getTemplate(config.tmpl)(data));
			render(config.$el);
		}

		watchData(config.dataKey,renderElement);
	}

	//
	function setController(key,func){
		controls[key] = func;
	}

	function getController(key){
		return controls[key] || defaultController;
	}

	function getElementConfig(e){
		var $e = $(e);
		var el  = $(e)[0];
		var hasTmpl = el.hasAttribute('data-tmpl');

		if(!hasTmpl) return false;

		var hasRef = el.hasAttribute('data-ref');
		var refIndex,ref;

		if(hasRef){
			refIndex = parseInt($e.attr('data-ref'));
		} else {
			refIndex = elementIndex++;

			var tmpl = getAttribute($e,'data-tmpl','defaultTemplate');
			var ctrl = getAttribute($e,'data-ctrl',tmpl);
			var dataKey = getAttribute($e,'data-watch',tmpl);

			elementRef[refIndex] = {
				index:refIndex,
				$el:$(e),
				el:$(e)[0],
				tmpl:tmpl,
				//tmpl:getTemplate(tmpl),
				ctrl:getController(ctrl),
				dataKey:dataKey,
				lastRendered:0, 
				rendered:false,
				initialized:false,
				changeIndex:null
			};
			$e.attr('data-ref',refIndex);
		}
		ref = elementRef[refIndex];
		return ref;
	}

	function render(e,depth){
		//console.log('Snap.render()',depth);

		if(!e) e = document.body;
		if(depth>20) return;
		var $e = $(e);
		var config = getElementConfig(e);

		if(config && config.initialized===false){
			// init controllers on elements
			config.initialized = true;
			new config.ctrl(e);
		}

		depth = (depth || 0)+1;

		$('[data-tmpl]',e).each(function(i,ee){
			render(ee,depth);
		});
	}

	function addTemplate(key,data){
		templates[key] = $.type(data)==='string' ? Handlebars.compile(data) : data;
		Handlebars.registerPartial(key,templates[key]);
	}

	function setTemplate(key,data){
		if(debug) console.log('Snap.setTemplate()',key,data);
		templates[key] = $.type(data)==='string' ? Handlebars.compile(data) : data;
		Handlebars.registerPartial(key,templates[key]);
		dispatchChange(key);
	}

	function getTemplate(key){
		return templates[key] || defaultTemplate;
	}

	function watchData(key,cb){
		if(!watchers[key]){
			watchers[key] = [];
		}
		watchers[key].push(cb);
		cb(getData(key));
	}

	function dispatchChange(key){
		if(debug) console.log('Snap.dispatchChange()',key);
		if(!watchers[key]) return;
		var data = getData(key);
		var i = watchers[key].length;
		while(i--){
			watchers[key][i](data);
			if(debug) console.log('--> ',i,watchers[key][i]);
		}
	}

	function setDataConfig(key,info){
		var config = dataConfig[key] = $.extend(getDataConfig(key), info);
		var data = config.defaultValue !== undefined ? config.defaultValue : null;

		// grab local storage data if available
		if(config.useLocalStorage){
			var ls = window.localStorage.getItem(key);
			if(ls!==null && ls!=='undefined'){
				try {
					data = $.parseJSON(ls);
				} catch(errr){
					console.error(key,'localstorage failed json parse',data,ls);
				}
			}
		}

		if(config.process && $.isFunction(config.process)){
			data = config.process(data);
		}
		setData(key,data);
	}

	function getDataConfig(key){
		return dataConfig[key] || {
			defaultValue:'',
			useLocalStorage:false,
			process:false,
			changeIndex:0
		};
	}

	function getData(key){
		if(debug) console.log('Snap.getData()',key);
		var data = null;
		if(datas[key]){
			data = datas[key];
		} else {
			var config = dataConfig[key];
			if(config && config.defaultValue){
				data = config.defaultValue;
			}
		}
		return data;
	}

	function setData(key, data, options){
		if(debug) console.log('Snap.setData()',key,data);
		// init config if not set
		if(!dataConfig[key]){
			dataConfig[key] = {changed:true};
		}
		var config = dataConfig[key];
		config.changeIndex++;

		//console.log('Snap.setData()',key,data);
		options = $.extend(options || {},{overwrite:false, triggerChange:true});
		var update = data;

		if($.isFunction(data)){
			update = data(getData(key));
		} else {
			if(datas[key] && options.overwrite!==true){
				switch($.type(datas[key])){
					case 'array' :
						if($.type(data)==='array'){
							// needs to support update id
						}
						update = data;
						break;
					case 'object' :
						update = $.extend(true,{},datas[key],data);
						break;
					case 'string' :
					case 'number' :
					default :
						update = data;
				}
			} else {
				update = data;
			}
		}
		// run process if specified
		if(config.process){
			update = config.process(update,datas[key]);
		}
		if(debug) console.log('--> ','update',update);
		// commit data
		datas[key] = update;

		// save to local storage if config.useLocalStorage === true
		if(config.useLocalStorage){
			window.localStorage.setItem(key, JSON.stringify(update));
		}

		if(options.triggerChange!==false){
			dispatchChange(key);
		}
	}

	function nextRequest(){
		if(requestStatus>0) return;
		requestStatus = 1;
		var entry = requestQueue.pop();
		$.ajax(entry).done(function(data){
			if(this.process){
				data = this.process(data);
			}
			if(this.dataKey){
				setData(this.dataKey,data);
			}
			if(this.callback){
				this.callback(data);
			}
			requestStatus = 0;
			if(requestQueue.length) nextRequest();
		})
	}

	function request(info){
		requestQueue.push(info);
		nextRequest();
	}

	function setDebug(active){
		debug = !!active;
	}

	return {
		request:request,
		setController:setController,
		getController:getController,
		render:render,
		addTemplate:addTemplate,
		setTemplate:setTemplate,
		getTemplate:getTemplate,
		watchData:watchData,
		dispatchChange:dispatchChange,
		getData:getData,
		setData:setData,
		setDataConfig:setDataConfig,
		setDebug:setDebug
	}

})();