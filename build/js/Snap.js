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
		defaultData:[], // set default value
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
	var watchersReuse = {};
	var datas = {};
	var dataConfig = {};
	var processors = {};
	var requestQueue = [];
	var requestStatus = 0;
	var elementIndex = 0;
	var elementRef = [];
	var controlInstance = [];

	// this helper allow dynamic templates in Handlebars
	// great for dynamic pages/SPA style stuff
	Handlebars.registerHelper('snaptmpl', function(template, context, opts) {
		if(!template || !context) return '';
		// extend data with manually passed parameters
		$.extend(context,opts ? opts.hash : {});
		var tmpl = Handlebars.partials[template];
	    return tmpl ? new Handlebars.SafeString(tmpl(context)) : '';
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
		return 'No Template. Data: '+JSON.stringify(data,null,2);
	}

	function removeWatcher(watcher){
		watchers[watcher.key][watcher.index] = null;
	}

	function cleanupElement(el){
		//return;
		// kill watchers
		var ctrl,c,w;
		$('[snap-ctrl]',el).each(function(i,e){
			ctrl = getElementController(e);
			c = ctrl.getConfig();
			//w = ctrl.getWatcherIndex();

			watcher = ctrl.getWatcher();
			watchers[watcher.key][watcher.index] = null;

			//console.log('remove watcher',watcher)
			// remove from watches
			//watchers[c.dataKey][w] = null;
			// get slot ready for reuse
			if(!watchersReuse[watcher.key]){
				watchersReuse[watcher.key] = [];
			}
			//watchersReuse[c.dataKey].push(w);
			watchersReuse[watcher.key].push(watcher.index);
		})
	}

	function defaultController(el){
		var config = getElementConfig(el);

		function renderElement(data){
			cleanupElement(config.$el);
			config.$el.html(getTemplate(config.tmpl)(data));
			render(config.$el);
		}

		function setConfig(update){
			$.extend(config,update);
			refresh();
		}

		function getConfig(update){
			return config;
		}

		function refresh(){
			renderElement(getData(config.dataKey));
		}

		var watcher = watchData(config.dataKey,renderElement);
		//var watchIndex = watcher.index;
		
		// function getWatcherIndex(){
		// 	return watcherIndex;
		// }

		function getWatcher(){
			return watcher;
		}

		return {
			setConfig:setConfig,
			getConfig:getConfig,
			//getWatcherIndex:getWatcherIndex,
			getWatcher:getWatcher
		}
	}

	function setController(key,func){
		controls[key] = func;
	}

	function getController(key){
		return controls[key] || defaultController;
	}

	function getControlInstance(i){
		return controlInstance[parseInt(i)];
	}

	function getElementController(el){
		var i;
		var hasCtrl = $(el)[0].hasAttribute('snap-ctrl');
		if(hasCtrl){
			i = $(el).attr('snap-ctrl');
			return getControlInstance(i);
		} else {
			var p = $(el).parents('[snap-ctrl]');

			if(p.length>0){
				i = $(p).attr('snap-ctrl');
				return getControlInstance(i);
			}
		}
		return null;
	}

	function getElementConfig(e){
		var $e = $(e);
		var el  = $(e)[0];
		var hasTmpl = el.hasAttribute('data-tmpl');

		//if(!hasTmpl) return false;

		if(!hasTmpl){
			$e = $e.parents('[data-tmpl]');
		}
		if($e.length===0){
			return false;
		} else {
			el = $e[0];
		}

		var hasRef = el.hasAttribute('data-ref');
		var refIndex,ref;

		if(hasRef){
			refIndex = parseInt($e.attr('data-ref'));
		} else {
			refIndex = elementIndex++;

			var tmpl = getAttribute($e,'data-tmpl','defaultTemplate');
			var ctrl = getAttribute($e,'data-ctrl',tmpl);
			//var dataKey = getAttribute($e,'data-watch',tmpl);
			var dataKey = getAttribute($e,'data-watch',false);

			if(dataKey===false){
				dataKey = tmpl;
				if(getData(tmpl)===null){
					// dummy data holder
					setData(tmpl,false);
					//setData(tmpl,'');
				}
			}

			elementRef[refIndex] = {
				index:refIndex,
				$el:$(e),
				el:$(e)[0],
				tmpl:tmpl,
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
		if(debug>3) console.log('Snap.render()',depth);
		if(!e) e = document.body;
		if(depth>20) return;
		var $e = $(e);
		var config = getElementConfig(e);

		if(config && config.initialized===false){
			// init controllers on elements
			config.initialized = true;
			$e.attr('snap-ctrl',controlInstance.push(new config.ctrl(e))-1);
		}

		depth = (depth || 0)+1;

		$('[data-tmpl]',e).each(function(i,ee){
			render(ee,depth);
		});
	}

	function setTemplate(key,data){
		if(debug>1) console.log('Snap.setTemplate()',key);//,data);
		templates[key] = $.type(data)==='string' ? Handlebars.compile(data) : data;
		Handlebars.registerPartial(key,templates[key]);
		dispatchChange(key);
	}

	function getTemplate(key){
		return templates[key] || defaultTemplate;
	}

	function watchData(key,cb){
		if(debug>1) console.log('watchData',key);
		var path = key.replace(/^.+?(?=[\[\.])/,'');
		var deep = key!==path;

		if(deep){
			key = key.match(/^.+?(?=[\[\.])/)[0];//.split('.')[0];
		}
		if(!watchers[key]){
			watchers[key] = [];
		}
		var watchIndex;

		// lets reuse watch index to avoid bloat in the array
		var watcher = {
			callback:cb,
			path:path, 
			deep:deep,
			key:key
		}

		if(watchersReuse[key] && watchersReuse[key].length>0){
			watchIndex = watchersReuse[key].pop();
			watchers[key][watchIndex] = watcher;
		} else {
			watchIndex = watchers[key].push(watcher)-1;
		}
		watcher.index = watchIndex;

		var data = getData(key);
		if(data!==null){
			runWatcher(watcher,data);
		}
		return watcher;//Index;
	}

	function audit(){
		var i = 0;
		for(var e in watchers){
			i += watchers[e].length;
		}
		console.log('TOTAL WATCHERS:',i);
	}

	function dispatchChange(key){
		if(debug>2) console.log('Snap.dispatchChange()',key);
		if(!watchers[key]) return;
		var data = getData(key);
		// don't trigger render on null data
		if(!data) return;
		var i = watchers[key].length;
		var w;
		while(i--){
			runWatcher(watchers[key][i],data);
		}
	}

	function runWatcher(watcher,data){
		if(watcher && watcher.callback){
			if(watcher.deep===true){
				data = eval('data'+watcher.path)
			}
			if(data!==undefined){
				watcher.callback(data)
			}
		}
	}

	function setDataConfig(key,info){
		if(debug>1) console.log('Snap.setDataConfig',key);//, datas[key])
		var config = dataConfig[key] = $.extend(getDataConfig(key), info);

		if(info.defaultValue){
			alert('Snap update: Change defaultValue to defaultData in '+key );
		}

		// if(datas[key]!=='undefined'){
		// 	var data = datas[key];
		// } else {
		// 	var data = config.defaultData !== undefined ? config.defaultData : null;
		// }

		var data = datas[key] || config.defaultData || null;

		// grab local storage data if available
		if(config.useLocalStorage){
			var ls = window.localStorage.getItem(key);
			if(ls!==null && ls!=='undefined'){
				try {
					data = $.parseJSON(ls);
					//data = $.extend($.parseJSON(ls),data || {})
				} catch(errr){
					if(debug) console.error(key,'localstorage failed json parse',data,ls);
				}
			}
		}

		if(config.process && $.isFunction(config.process)){
			try {
				data = config.process(data);
			} catch(err) {
				if(debug) console.error('Snap.setDataConfig() config.process',key);
			}
		}
		if(data){
			setData(key,data);
		}
	}

	function flushLocalStorage(key){
		window.localStorage.removeItem(key);
	}

	function getDataConfig(key){
		return dataConfig[key] || {
			defaultData:'',
			useLocalStorage:false,
			process:false,
			changeIndex:0
		};
	}

	function getData(key){
		if(key instanceof jQuery || (key && key.tagName)){
			key = getElementDataKey(key);
		}
		if(debug>1) console.log('Snap.getData()',key);
		var data = null;
		if(key in datas){//datas[key]){
			data = datas[key];
		} else {
			var config = dataConfig[key];
			if(config && config.defaultData){
				data = config.defaultData;
			}
		}
		// this should clone so the object is immutable
		// clone function doesn't work on object that has back references
		// try {
		// 	data = $.extend(true,{},data)
		// } catch(err){
		// 	console.warn('Snap.getData()',key,'object can not be cloned')
		// }
		return data;
	}

	function getElementDataKey(el){
		var config = getElementConfig(el);
		return config ? config.dataKey : null;
	}

	function setData(key, data, options){

		if(key instanceof jQuery || (key && key.tagName)){
			key = getElementDataKey(key);
		}
		if(debug) console.log('Snap.setData()',key);//,data);if(debug>0) 
		// init config if not set
		if(!dataConfig[key]){
			dataConfig[key] = {changed:true};
		}
		var config = dataConfig[key];
		config.changeIndex++;

		options = $.extend({overwrite:false, triggerChange:true},options || {});
		var update = data;
		var currentData = getData(key);

		if($.isFunction(data)){
			update = data(currentData);
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
						if(options.deep===true){
							update = $.extend(true,{},currentData,data);
						} else {
							update = $.extend({},currentData,data);
						}
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
			try {
				update = config.process(update,currentData);
			} catch(err) {
				if(debug) console.error('Snap.setData() config.process',key);
			}
		}
		if(processors[key]){
			//var i = processors[key].length;
			for(var i=0; i<processors[key].length; i++){
			//while(i--){
				update = processors[key][i](update,currentData);
			}
		}
		//if(debug) console.log('--> ','update',update);
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

	function addProcess(key, func, options){
		if(!processors[key]){
			processors[key] = []
		}
		if(!options){
			options = {}
		}
		if(!options.priority){
			options.priority = processors[key].length
		}
		processors[key].push(func)
		processors[key].sort(function(a,b){
			return a.priority<b.priority ? -1 : a.priority>b.priority ? 1 : 0
		})
	}

	function handleAjaxComplete(data){
		if(this.process){
			data = this.process(data);
		}
		if(this.dataKey){
			setData(this.dataKey,data,{overwrite:this.overwrite===true});
		}
		if(this.callback){
			this.callback(data);
		}
		requestStatus = 0;
		if(requestQueue.length){
			nextRequest();
		}
	}

	function handleAjaxError(){
		console.log('Snap.handleAjaxError() There was an error');
		this.data = {error:true, errorMessage:'Unknown error.'};
		handleAjaxComplete(this);
	}

	function nextRequest(){
		if(requestStatus>0) return;
		requestStatus = 1;
		var entry = requestQueue.pop();
		if(debug>0) console.log('Snap.request()',entry);

		$.ajax($.extend({
			dataType:'json',
			error:handleAjaxError,
			success:handleAjaxComplete 
		},entry));
	}

	function request(info){
		requestQueue.push(info);
		nextRequest();
	}

	function setDebug(active){
		debug = $.isNumeric(active) ? active : active ? 1 : 0;
	}

	return {
		audit:audit,
		request:request,
		setController:setController,
		getController:getController,
		getControlInstance:getControlInstance,
		render:render,
		getElementConfig:getElementConfig,
		getElementController:getElementController,
		setTemplate:setTemplate,
		getTemplate:getTemplate,
		watchData:watchData,
		dispatchChange:dispatchChange,
		getData:getData,
		setData:setData,
		setDataConfig:setDataConfig,
		setDebug:setDebug,
		addProcess:addProcess,
		setProcess:addProcess,
		getElementDataKey:getElementDataKey,
		getWatchers:function(){
			return watchers;
		},
		flushLocalStorage:flushLocalStorage
	}

})();