define([

    'underscore','backbone',

    'mediaelement'

], function(

    _, Backbone,

    MediaElement

) {

    'use strict';
        
    // jQuery pulled from Backbone own version
    var $ = Backbone.$;

    var VideoView = Backbone.View.extend({

        className: 'mediatheque-video',

        options: {
            source: null,
            width: 320,
            height: 240,
            duration: null,
            start: 0,
            end: 0,
            volume: 1,
            loop: false,
            muted: false,
            autoplay: false,
            preload: false,
            
            debug: false,
            pluginPath: '/bower_components/mediaelement/build/',
            timeUpdateInterval: 30,
            
            keepVisible: false,
            centerX: 'center',
            centerY: 'middle'
        },

        events: {

        },

        $playerContainer: null,
        player: null,
        video: null,

        ready: false,
        preloaded: false,
        loaded: false,
        
        playing: false,
        paused: false,
        
        preloadTime: 0,
        preloadFirstPlay: false,
        preloadCanPlay: false,
        preloadCanPlayThrough: false,

        currentTime: 0,
        _timeUpdateInterval: null,
        
        duration: 0,
        videoWidth: 0,
        videoHeight: 0,

        width: 0,
        height: 0,
        x: 0,
        y: 0,
        

        initialize: function(options) {

            this.options = _.extend({},this.options, options);

            //Build sources
            var source = {};
            if(typeof(this.options.source) === 'string') {
                source['video/mp4'] = this.options.source;
            } else {
                _.each(this.options.source,function(path,type) {
                    source['video/'+type] = path;
                });
            }
            this.options.source = source;
            
            _.bindAll(this,
                '_handlePlayerPreProgress',
                '_handlePlayerPreCanplay',
                '_handlePlayerPreCanplayThrough',
                '_handlePlayerPreTimeupdate',
                '_handlePlayerReady',
                '_handlePlayerLoaded',
                '_handlePlayerLoadedMetadata',
                '_handlePlayerCanPlay',
                '_handlePlayerPlay',
                '_handlePlayerPause',
                '_handlePlayerEnded',
                '_handlePlayerError',
                '_handlePlayerTimeupdate',
                '_handleTimeUpdateInterval');

        },

        render: function() {
            
            this.$playerContainer = $('<div class="mediatheque-video-player"></div>');
            this.$playerContainer.html(this.getVideoHTML());
            this.$el.append(this.$playerContainer);

            this.resize();

            this.video = this.$el.find('video')[0];
            
            this.player = new MediaElement(this.video, {
                enablePluginDebug: this.options.debug,
                plugins: ['flash','silverlight'],
                pluginPath: this.options.pluginPath,
                startVolume: 0,
                defaultVideoWidth: this.options.width,
                defaultVideoHeight: this.options.height,
                pluginWidth: this.width,
                pluginHeight: this.height,
                success: _.bind(function (mediaElement, domObject)
                {
                    this.player = mediaElement;
                    
                    //Player ready
                    window.setTimeout(_.bind(function()
                    {
                        this._handlePlayerReady();
                    },this),1);
                    
                    //Preload
                    if(this.options.preload)
                    {
                        window.setTimeout(_.bind(function()
                        {
                            this.preloadTime = this.options.start || 0;
                            this.preload();
                        },this),10);
                    }
                    else
                    {
                        this.bindPlayerEvents();
                    }
                },this),
                error: _.bind(function ()
                { 
                    this.log('mediaElement error',arguments[0]);
                },this)
            });

        },
        
        getVideoHTML: function()
        {
            var attributes = [];
            if(this.options.preload)
            {
                attributes.push('preload="auto"');
                attributes.push('autoplay');
                attributes.push('muted');
            }
            else
            {
                attributes.push('preload="metadata"');
                if(this.options.autoplay)
                {
                    attributes.push('autoplay');
                }
                if(this.options.muted)
                {
                    attributes.push('muted');
                }
            }
            
            var html = [];
            html.push('<video width="100%" height="100%" style="width: 100%; height:100%;" '+attributes.join(' ')+'>');
            _.each(this.options.source, function(path,type) {
                html.push('<source src="' + path + '" type="' + type + '">');
            });
            html.push('</video>');
            return html.join('');
        },
        
        bindPlayerEvents: function()
        {
            this.unbindPreloadPlayerEvents();
            
            this.player.addEventListener('loadeddata',this._handlePlayerLoaded, false);
            this.player.addEventListener('loadedmetadata',this._handlePlayerLoadedMetadata, false);
            this.player.addEventListener('canplay',this._handlePlayerCanPlay, false);
            this.player.addEventListener('play',this._handlePlayerPlay, false);
            this.player.addEventListener('pause',this._handlePlayerPause, false);
            this.player.addEventListener('ended',this._handlePlayerEnded, false);
            this.player.addEventListener('error', this._handlePlayerError, false);
            this.player.addEventListener('timeupdate', this._handlePlayerTimeupdate, false);
        },
        
        bindPreloadPlayerEvents: function()
        {
            this.unbindPlayerEvents();
            
            this.player.addEventListener('canplay', this._handlePlayerPreCanplay, false);
            this.player.addEventListener('progress', this._handlePlayerPreProgress, false);
            this.player.addEventListener('timeupdate', this._handlePlayerPreTimeupdate, false);
        },
        
        unbindPlayerEvents: function()
        {
            try
            {
                this.player.removeEventListener('loadeddata',this._handlePlayerLoaded);
                this.player.removeEventListener('loadedmetadata',this._handlePlayerLoadedMetadata);
                this.player.removeEventListener('canplay',this._handlePlayerCanPlay);
                this.player.removeEventListener('play',this._handlePlayerPlay);
                this.player.removeEventListener('pause',this._handlePlayerPause);
                this.player.removeEventListener('ended',this._handlePlayerEnded);
                this.player.removeEventListener('error', this._handlePlayerError);
                this.player.removeEventListener('timeupdate', this._handlePlayerTimeupdate);
            }
            catch(e) {}
        },
        
        unbindPreloadPlayerEvents: function()
        {
            try
            {
                this.player.removeEventListener('canplay', this._handlePlayerPreCanplay);
                this.player.removeEventListener('progress', this._handlePlayerPreProgress);
                this.player.removeEventListener('timeupdate', this._handlePlayerPreTimeupdate);
            }
            catch(e) {}
        },

        resize: function(newWidth, newHeight)
        {    
            var videoWidth = this.options.width;
            var videoHeight = this.options.height;
            var videoRatio = videoWidth/videoHeight;

            var viewWidth = newWidth || this.$el.width();
            var viewHeight = newHeight || this.$el.height();
            var viewRatio = viewWidth/viewHeight;

            var width = 0,
                height = 0,
                top = 0,
                left = 0;
            if(this.options.keepVisible)
            {
                if(videoRatio > viewRatio)
                {
                    width = viewWidth;
                    height = viewWidth / videoRatio;
                }
                else
                {
                    height = viewHeight;
                    width = viewHeight * videoRatio;
                }
            }
            else
            {
                if(videoRatio > viewRatio)
                {
                    height = viewHeight;
                    width = viewHeight * videoRatio;
                }
                else
                {
                    width = viewWidth;
                    height = viewWidth / videoRatio;
                }
            }
            
            if(this.options.centerX === 'right')
            {
                left = -(width - viewWidth);
            }
            else if(this.options.centerX === 'center')
            {
                left = -((width - viewWidth)/2);
            }
            
            if(this.options.centerY === 'bottom')
            {
                top = -(height - viewHeight);
            }
            else if(this.options.centerY === 'middle')
            {
                top = -((height - viewHeight)/2);
            }

            this.width = Math.round(width);
            this.height = Math.round(height);
            this.x = Math.round(left);
            this.y = Math.round(top);

            if(this.$('.mediatheque-video-player').length) {
                this.$('.mediatheque-video-player').css({
                    'width' : this.width + 'px',
                    'height' : this.height + 'px',
                    'top' : this.y + 'px',
                    'left' : this.x + 'px'
                });
            }
            
            if(this.player && this.player.setVideoSize) {
                this.player.setVideoSize(this.width,this.height);
            }
        },

        remove: function()
        {
            this._stopTimeUpdateInterval();

            if(this.player && this.player.remove) {
                
                this.unbindPlayerEvents();
                this.unbindPreloadPlayerEvents();
                
                try {
                    this.player.remove();
                } catch(e){}
                
                this.player = null;
            }

            Backbone.View.prototype.remove.apply(this,arguments);
        },

        play: function()
        {
            if(!this.player)
            {
                return;
            }
            
            if(this.options.preload && !this.preloaded)
            {
                this.once('player:loaded',this._play);
            }
            else
            {
                this._play();
            }
        },
        
        _play: function()
        {
            this.log('play', this.player.currentTime);
            
            this.paused = false;

            this.player.play();
        },

        pause: function()
        {
            if(!this.player) {
                return;
            }
            
            this.log('pause');
            
            this.paused = true;
                
            this.player.pause();
        },
        
        stop: function()
        {
            if(!this.player) {
                return;
            }
            
            this.log('stop');
            
            this.paused = false;
                
            this.player.pause();
            
            this.rewind();
        },
        
        rewind: function()
        {
            try
            {
                this.setCurrentTime(this.options.start || 0);
                
                this.log('player.rewind',this.player.currentTime);
            }
            catch(e){}    
        },

        getCurrentTime: function()
        {
            return this.player ? this.player.currentTime:0;
        },

        setCurrentTime: function(time)
        {
            if(this,player)
            {
                this.player.setCurrentTime(time);
            }
        },
        
        setCurrentTimeAndPreload: function(time)
        {
            if(Math.round(time) === Math.round(this.getCurrentTime()))
            {
                this.log('Skip preloading');
                return;
            }
            
            this.preloadTime = time;
            this.preload();
        },
        
        preload: function()
        {
            this.preloaded = false;
            this.preloadFirstPlay = false;
            this.preloadCanPlay = false;
            this.preloadCanPlayThrough = false;
            
            this.player.pause();
            this.player.setVolume(0);
            this.player.setMuted(true);
            
            this.bindPreloadPlayerEvents();
            
            this.player.setCurrentTime(this.preloadTime);
            this.player.play();
        },
        
        resetPlayer: function()
        {
            this.player.setCurrentTime(this.preloadTime);
            
            this.player.setVolume(this.options.volume);
            this.player.setMuted(this.options.muted);
            
            this.bindPlayerEvents();
        },

        setVolume: function(volume)
        {
            this.options.volume = volume;
            
            if(this.player) {
                this.player.setVolume(volume);
            }
        },

        mute: function()
        {
            this.options.muted = true;
            
            if(this.player) {
                this.player.setMuted(true);
            }
        },

        unmute: function()
        {
            this.options.muted = false;
            
            if(this.player) {
                this.player.setMuted(false);
            }
        },
        
        playProgress: function()
        {
            if(this.player)
            {
                var currentTime = this.getCurrentTime();
                var duration = this.options.duration || this.player.duration;
                return duration === 0 ? 0:(currentTime/duration);
            }
            
            return 0;
        },

        /**
         * 
         * Time update interval
         *
         */
        _startTimeUpdateInterval: function() {

            if(this._timeUpdateInterval)
            {
                return;
            }
            
            var interval = this.options.timeUpdateInterval;
            this._timeUpdateInterval = setInterval(this._handleTimeUpdateInterval,interval);

        },

        _stopTimeUpdateInterval: function() {

            if(this._timeUpdateInterval)
            {
                clearInterval(this._timeUpdateInterval);
                this._timeUpdateInterval = null;
            }

        },
        
        forcePreloadPlay: function()
        {
            var currentTime = this.getCurrentTime();
            if(!this.preloadFirstPlay && currentTime < this.preloadTime)
            {
                this.log('force preload play', currentTime);
                this.player.play();
                this.player.setCurrentTime(this.preloadTime);
            }
        },
        
        _handlePlayerReady: function()
        {
            this.log('player.ready');

            this.ready = true;
            
            this.resize();
            
            this.trigger('player:ready');
        },
        
        _handlePlayerPreCanplay: function()
        {
            this.log('pre.canplay');
            
            this.preloadCanPlay = true;
            
            this.forcePreloadPlay();
        },
        
        _handlePlayerPreCanplayThrough: function()
        {
            this.log('pre.canplaythrough');
        
            this.preloadCanPlayThrough = true;
            
            this.forcePreloadPlay();
        },
        
        _handlePlayerPreProgress: function(e)
        {
            var player = e.target;
            
            var duration = player && player.duration ? player.duration:0;
            var end = player && player.buffered && player.buffered.length ? player.buffered.end(0):0;
            var progress = duration && end ? (end/duration):0;
            
            this.log('pre.progress',progress);
            
            if(progress > 0) {
                this.forcePreloadPlay();
            }
        },
        
        _handlePlayerPreTimeupdate: function(e)
        {    
            var currentTime = this.getCurrentTime();
            
            if(!this.preloadFirstPlay)
            {
                var delta = Math.abs(currentTime - this.preloadTime);
                if(currentTime > this.preloadTime)
                {
                    this.preloadFirstPlay = true;
                    this.player.pause();
                }
                else if(delta > 1)
                {
                    this.forcePreloadPlay();
                }
            }
            
            this.log('pre.timeupdate', currentTime, this.preloadFirstPlay, this.preloadCanPlay);
            
            if(this.preloadFirstPlay && currentTime >= this.preloadTime)
            {
                this._handlePlayerPreloaded();
            }
        },
        
        _handlePlayerPreloaded: function()
        {    
            if(this.preloaded)
            {
                return;
            }
            
            this.preloaded = true;
            this.loaded = true;
            
            this.resetPlayer();
            
            this.log('player.preloaded');
            
            window.setTimeout(_.bind(function() {
                this.trigger('player:loaded');
            },this),1);
        },
        
        _handlePlayerLoadedMetadata: function()
        {
            
            this.log('player.loadedmetadata');
            
            if(!this.loaded)
            {
                this.loaded = true;
                
                window.setTimeout(_.bind(function() {
                    this.trigger('player:loaded');
                },this),1);
            }
        },
        
        _handlePlayerLoaded: function()
        {
            this.log('player.loaded');
        },
        
        _handlePlayerCanPlay: function()
        {
            this.log('player.canplay');
        },

        _handlePlayerPlay: function()
        {
            this.log('player.play');

            this.playing = true;
            this.paused = false;
            this._startTimeUpdateInterval();

            window.setTimeout(_.bind(function() {
                this.trigger('player:play');
            },this),1);
        },

        _handlePlayerPause: function()
        {
            this.log('player.pause');

            this.playing = false;
            this.paused = true;
            this._stopTimeUpdateInterval();

            window.setTimeout(_.bind(function() {
                this.trigger('player:pause');
            },this),1);
        },

        _handlePlayerEnded: function()
        {
            this.log('player.ended');
            
            this.playing = false;
            this.paused = false;
            this._stopTimeUpdateInterval();

            window.setTimeout(_.bind(function() {
                this.trigger('player:ended');
                if(this.options.loop)
                {
                    this.player.play();
                }
            },this),1);
        },
        
        _handleTimeUpdateInterval: function()
        {
            this._handlePlayerTimeupdate();
        },

        _handlePlayerTimeupdate: function()
        {
            if(!this.player)
            {
                return;
            }

            try
            {
                this.currentTime = this.player.currentTime;
            }
            catch(e){}

            this.trigger('player:timeupdate',this.currentTime);
            
            if(this.options.end > 0 && this.currentTime >= this.options.end)
            {
                this.stop();
                this._handlePlayerEnded();
            }
        },

        _handlePlayerError: function()
        {
            this.log('error',arguments);
        },
        
        log: function()
        {
            if(this.options.debug)
            {
                var args = ['[video]'];
                for(var i = 0, al = arguments.length; i < al; i++)
                {
                    args.push(arguments[i]);
                }
                console.log.apply(console, args);
            }
        }

    });
    
    VideoView.canPlay = function(type) {
        var elem = document.createElement('video'),
            bool = false;

        // IE9 Running on Windows Server SKU can cause an exception to be thrown, bug #224
        try
        {
            bool = !!elem.canPlayType;
            if(bool && typeof(type) !== 'undefined')
            {
                if(type === 'webm')
                {
                    bool = elem.canPlayType('video/webm; codecs="vp8, vorbis"').replace(/^no$/,'').length ? true:false;
                }
                else if(type === 'ogg')
                {
                    bool = elem.canPlayType('video/ogg; codecs="theora"').replace(/^no$/,'').length ? true:false;
                }
                else if(type === 'h264')
                {
                    bool = elem.canPlayType('video/mp4; codecs="avc1.42E01E"').replace(/^no$/,'').length ? true:false;
                }
                else
                {
                    bool = false;
                }
            }
        }
        catch(e) { }

        return bool;
    };

    return VideoView;

});
