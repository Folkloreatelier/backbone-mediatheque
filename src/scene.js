define(['underscore', 'backbone'], function(_, Backbone) {
    
    // Underscore and jQuery pulled from Backbone own versions
    var $ = Backbone.$;
    
    // Built-in methods that cannot be removed
    var builtInMethods = ['init', 'build', 'destroy', 'resize'];
    
    // The scene view extends backbone view
    var SceneView = Backbone.View.extend({
		
        methods: ['play', 'pause', 'stop', 'end'],
		
		initialize: function(options)
		{
			this.options = _.extend({}, this.options || {}, options);
			
			this.prepareMethods();
			
			this.init();
            
            $(window).on('resize',this.resize);
		},
		
        // Prepare the methods by proxying existing methods and triggering
        // an event before and after the method
		prepareMethods: function()
		{
            var methods = _.union(builtInMethods, this.methods);
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
		
        // Automatically call the build method on render
		render: function()
		{
			this.build();
		},
		
        // Automatically call the destroy method on remove
		remove: function()
		{
			this.destroy();
            
            $(window).off('resize',this.resize);
			
			Backbone.View.prototype.remove.apply(this,arguments);
		}
		
		
	});
	
	
	return SceneView;
    
});
