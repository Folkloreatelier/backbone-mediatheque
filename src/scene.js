define(['backbone'], function(Backbone) {
    
    var $ = Backbone.$;
    
    var builtInMethods = ['init', 'build', 'destroy', 'resize'];
    
    var SceneView = Backbone.View.extend({
		
        methods: ['play', 'pause', 'stop', 'end'],
		
		initialize: function(options)
		{
			this.options = _.extend({}, this.options || {}, options);
			
			this.prepareMethods();
			
			this.init();
            
            $(window).on('resize',this.resize);
		},
		
		prepareMethods: function()
		{
            var methods = _.union(builtInMethods, this.options.methods);
            var noop = function(){};
            
			_.each(methods, _.bind(function(methodName)
			{
				
				var method = this[methodName] || noop;
				
				this[methodName] = _.bind(function() {
					
					this.trigger(methodName+':before', this);
					
					method.apply(this,arguments);
					
					window.setTimeout(_.bind(function() {
						this.trigger(methodName, this);
					},this),1);
					
				},this);
				
			},this));
		},
		
		render: function()
		{
			this.build();
		},
		
		remove: function()
		{
			this.destroy();
            
            $(window).off('resize',this.resize);
			
			Backbone.View.prototype.remove.apply(this,arguments);
		}
		
		
	});
	
	
	return SceneView;
    
});
