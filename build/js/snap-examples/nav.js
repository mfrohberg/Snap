var Nav = (function(self){

	Snap.setTemplate('nav','<ul class="nav">{{#each children}}<li data-index="{{@index}}" {{selected}} onclick="Nav.select(this)">{{{label}}}</li>{{/each}}</ul>');

	Snap.setData('nav',{
		children:[
			{label:'Section 1', selected:true},
			{label:'Section 2', selected:false},
			{label:'Section 3', selected:false}
		]
	})

	function select(el){
		var index = psrseInt($(el).attr('data-index'))

		Snap.setData('nav',function(data){
			data.children = $.map(data.children, function(e,i){
				e.selected = i===index ? 'selected' : ''
			})
			return data;
		})
	}

	self.select = select;

	return self

})(window.Nav || {})