var ManageRecords = function(options){

	var parentObject = options.dataKey || '';
	var recordPrefix = options.recordPrefix || parentObject+'-entry-';
	var viewTemplate = options.viewTemplate || recordPrefix+'view';
	var editTemplate = options.editTemplate || recordPrefix+'edit';
	var blankEntry = options.blankEntry || {};

	function edit(id){
		Snap.setTemplate(recordPrefix+id,Snap.getTemplate(editTemplate));
	}

	function cancel(form){
		var id = $('[name="id"]',form).val();
		Snap.setTemplate(recordPrefix+id,Snap.getTemplate(viewTemplate));
	}

	function remove(form){
		if(confirm('Are you sure?')){
			var id = $('[name="id"]',form).val();
			// this would send a delete request to the service which would return the updated object
			Snap.setData(parentObject,function(data){
				data.entries = $.grep(data.entries,function(e){
					return String(e.id)!==String(id);
				});
				return data;
			});
		}
	}

	function create(){
		Snap.setData(parentObject, function(data){
			data.entries.push(blankEntry);
			console.log(blankEntry);
			return data;
		});

		Snap.setTemplate(recordPrefix+blankEntry.id,Snap.getTemplate(viewTemplate));
	}

	function save(form){

		// get form data as object
		var $form = $(form);
		var update = {};
		var arr = $form.serializeArray();

		$.each(arr,function(i,e){
			update[e.name] = e.value;
		});

		// run any validation here...

		Snap.setData(recordPrefix+update.id,function(data){
			// apply form values to data - this should be a configurable option
			$.extend(data,update);
			return data;
		});

		Snap.setTemplate(recordPrefix+update.id,Snap.getTemplate(viewTemplate));
	}
	
	Snap.watchData(parentObject, function(data){
		if(data && data.entries){
			$.each(data.entries,function(i,e){
				console.log('setData',recordPrefix+e.id);
				Snap.setData(recordPrefix+e.id,e);
				Snap.setTemplate(recordPrefix+e.id,Snap.getTemplate(viewTemplate));
			});
		}
	})

	return {
		save:save,
		edit:edit,
		cancel:cancel,
		create:create,
		remove:remove
	}
}