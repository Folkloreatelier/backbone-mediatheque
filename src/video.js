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
            debug: false,
            pluginPath: '/bower_components/mediaelement/build/',
            source: null,
            timeUpdateInterval: 30,
            width: 320,
            height: 240,
            loop: false,
            muted: false,
            autoplay: false,
            duration: null,
            start: 0,
            end: 0,
            volume: 1,
            readyTimeout: 1000,
            keepVisible: false,
            centerY: 'middle'
        },

        events: {

        },

        $playerContainer: null,
        player: null,

        ready: false,
        loaded: false,
        reallyLoaded: false,
        playing: false,
        paused: false,
        canPlayThrough: false,
        firstPlay: false,
        
        canplayThroughTimeout: null,

        currentTime: 0,
        duration: 0,

        _timeUpdateInterval: null,

        width: 0,
        height: 0,
        x: 0,
        y: 0,

        initialize: function(options) {

            this.options = _.extend({},this.options,options);

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
            
            //Get filename
            this.filename = '';
            for(var key in this.options.source) {
                this.filename = this.options.source[key].match(/\/([^\/]+)$/)[1];
                break;
            }
            
            _.bindAll(this,
                '_handlePlayerPreProgress',
                '_handlePlayerPreCanplay',
                '_handlePlayerPreCanplayThrough',
                '_handlePlayerPreTimeupdate',
                '_handlePlayerReady',
                '_handlePlayerLoaded',
                '_handlePlayerCanPlay',
                '_handlePlayerPlay',
                '_handlePlayerPause',
                '_handlePlayerEnded',
                '_handlePlayerError',
                '_handlePlayerTimeupdate');

        },

        render: function() {
            
            this.$playerContainer = $('<div class="mediatheque-video-player"></div>');
            this.$playerContainer.html(this.getVideoHTML());
            this.$el.append(this.$playerContainer);

            this.resize();

            var video = this.$el.find('video')[0];
            
            this.player = new MediaElement(video, {
                enablePluginDebug: false,
                plugins: ['flash','silverlight'],
                pluginPath: this.options.pluginPath,
                startVolume: 0,
                defaultVideoWidth: this.options.width,
                defaultVideoHeight: this.options.height,
                pluginWidth: this.width,
                pluginHeight: this.height,
                success: _.bind(function (mediaElement, domObject) {
                    
                    this.player = mediaElement;
                    
                    mediaElement.addEventListener('canplay', this._handlePlayerPreCanplay, false);
                    mediaElement.addEventListener('canplaythrough', this._handlePlayerPreCanplayThrough, false);
                    mediaElement.addEventListener('progress', this._handlePlayerPreProgress, false);
                    mediaElement.addEventListener('timeupdate', this._handlePlayerPreTimeupdate, false);
                     
                    window.setTimeout(this._handlePlayerReady,1);
                     
                },this),
                error: _.bind(function () { 
                    this.log('mediaElement error',arguments[0]);
                },this)
            });

        },
        
        getVideoHTML: function()
        {
            var html = [];
            html.push('<video width="100%" height="100%" style="width: 100%; height:100%;" preload="auto" autoplay muted>');
            _.each(this.options.source, function(path,type) {
                html.push('<source src="' + path + '" type="' + type + '">');
            });
            html.push('</video>');
            return html.join('');
        },
        
        bindPlayerEvents: function() {
            
            this.player.removeEventListener('canplay', this._handlePlayerPreCanplay);
            this.player.removeEventListener('progress', this._handlePlayerPreProgress);
            this.player.removeEventListener('timeupdate', this._handlePlayerPreTimeupdate);
            
            this.player.addEventListener('loadeddata',this._handlePlayerLoaded, false);
            this.player.addEventListener('canplay',this._handlePlayerCanPlay, false);
            this.player.addEventListener('play',this._handlePlayerPlay, false);
            this.player.addEventListener('pause',this._handlePlayerPause, false);
            this.player.addEventListener('ended',this._handlePlayerEnded, false);
            this.player.addEventListener('error', this._handlePlayerError, false);
            this.player.addEventListener('timeupdate', this._handlePlayerTimeupdate, false);
            
        },
        
        resetPlayer: function() {
            this.resize();
            this.resetPlayerCurrentTime();
            this.player.setVolume(this.options.volume);
            this.player.setMuted(this.options.muted);
        },

        resize: function(newWidth, newHeight) {

            var videoWidth = this.options.width;
            var videoHeight = this.options.height;
            var videoRatio = videoWidth/videoHeight;

            var viewWidth = newWidth;
            var viewHeight = newHeight;
            var viewRatio = viewWidth/viewHeight;

            var width = 0,
                height = 0,
                top = 0,
                left = 0;
            if(this.options.keepVisible) {
                if(videoRatio > viewRatio) {
                    width = viewWidth;
                    height = viewWidth / videoRatio;
                    left = 0;
                    top = -((height - viewHeight)/2);
                } else {
                    height = viewHeight;
                    width = viewHeight * videoRatio;
                    top = 0;
                    left = -((width - viewWidth)/2);
                }
            } else {
                if(videoRatio > viewRatio) {
                    height = viewHeight;
                    width = viewHeight * videoRatio;
                    top = 0;
                    left = -((width - viewWidth)/2);
                } else {
                    width = viewWidth;
                    height = viewWidth / videoRatio;
                    left = 0;
                    if(this.options.centerY === 'top') {
                        top = 0;
                    } else if(this.options.centerY === 'bottom') {
                        top = -(height - viewHeight);
                    } else {
                        top = -((height - viewHeight)/2);
                    }
                }
            }
            

            this.width = Math.round(width);
            this.height = Math.round(height);
            this.x = Math.round(left);
            this.y = Math.round(top);

            if(this.$('.video-player').length) {
                this.$('.video-player').css({
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

        remove: function() {

            if(this.player && this.player.remove) {
                
                try {
                    if(!this.reallyLoaded) {
                        this.player.removeEventListener('canplay', this._handlePlayerPreCanplay);
                        this.player.removeEventListener('progress', this._handlePlayerPreProgress);
                        this.player.removeEventListener('timeupdate', this._handlePlayerPreTimeupdate);
                    } else {
                        this.player.removeEventListener('loadeddata',this._handlePlayerLoaded);
                        this.player.removeEventListener('canplay',this._handlePlayerCanPlay);
                        this.player.removeEventListener('play',this._handlePlayerPlay);
                        this.player.removeEventListener('pause',this._handlePlayerPause);
                        this.player.removeEventListener('ended',this._handlePlayerEnded);
                        this.player.removeEventListener('error', this._handlePlayerError);
                        this.player.removeEventListener('timeupdate', this._handlePlayerTimeupdate);
                    }
                } catch(e){}
                
                try {
                    this.player.remove();
                } catch(e){}
                
                this.player = null;
            }
            
            this._stopTimeUpdateInterval();

            Backbone.View.prototype.remove.apply(this,arguments);
        },

        play: function() {

            if(!this.player) {
                return;
            }
            
            if(!this.reallyLoaded)
            {
                this.once('player:loaded',this._play);
            }
            else
            {
                this._play();
            }
            
            
        },
        
        _play: function() {
            
            if(!this.paused) {
                this.resetPlayerCurrentTime();
            }
            
            this.log('play', this.player.currentTime);
            
            this.paused = false;

            this.player.play();
        },

        pause: function() {
            
            if(!this.player) {
                return;
            }
            
            this.log('pause');
            
            this.paused = true;
                
            this.player.pause();
        },
        
        stop: function() {
            
            if(!this.player) {
                return;
            }
            
            this.log('stop');
            
            this.paused = false;
                
            this.player.pause();
            
            this.resetPlayerCurrentTime();
        },
        
        resetPlayerCurrentTime: function() {
            try {
                if(this.options.start) {
                    this.player.setCurrentTime(this.options.start);
                } else {
                    this.player.setCurrentTime(0);
                }
                this.log('player.resetCurrentTime',this.player.currentTime);
            } catch(e){}
            
        },

        getCurrentTime: function() {
            if(!this.player) {
                return 0;
            }
            return this.player.currentTime;
        },

        setCurrentTime: function(time) {
            this.player.setCurrentTime(time);
        },

        setVolume: function(volume) {
            this.player.setVolume(volume);
        },

        mute: function() {
            this.options.muted = true;
            
            if(this.player) {
                this.player.setMuted(true);
            }
        },

        unmute: function() {
            this.options.muted = false;
            
            if(this.player) {
                this.player.setMuted(false);
            }
        },
        
        playProgress: function() {
            
            if(this.player) {
                var duration = this.options.duration || this.player.duration;
                return duration === 0 ? 0:(this.player.currentTime/duration);
            }
            
            return 0;
            
        },

        _startTimeUpdateInterval: function() {

            if(this._timeUpdateInterval) {
                return;
            }
            
            var callback = _.bind(this._handleTimeUpdateInterval,this);
            this._timeUpdateInterval = setInterval(callback,this.options.timeUpdateInterval);

        },

        _stopTimeUpdateInterval: function() {

            if(this._timeUpdateInterval) {
                clearInterval(this._timeUpdateInterval);
                this._timeUpdateInterval = null;
            }

        },
        
        _handlePlayerReady: function() {
            
            this.log('player.ready');

            this.ready = true;
            
            this.resize();
            
            this.trigger('player:ready');

        },
        
        _handlePlayerPreCanplay: function() {
            this.log('pre.canplay');
            if(!this.firstPlay) {
                this.player.play();
            } else if(this.player.pluginType === 'native') {
                this._handlePlayerPreCanReallyPlay();
            }
        },
        
        _handlePlayerPreCanplayThrough: function() {
            
            this.canPlayThrough = true;
            this.log('pre.canplaythrough');
            
            if(this.firstPlay && this.player && this.player.pluginType === 'native') {
                this._handlePlayerPreCanReallyPlay();
            }
            
        },
        
        _handlePlayerPreCanReallyPlay: function() {
            if(this.canplayThroughTimeout) {
                this.log('canplayThroughTimeout cleared');
                window.clearTimeout(this.canplayThroughTimeout);
                this.canplayThroughTimeout = null;
            }
            this._handlePlayerReallyLoaded();
        },
        
        _handlePlayerPreProgress: function(e) {
            var player = e.target;
            var duration = player && player.duration ? player.duration:0;
            var end = player && player.buffered && player.buffered.length ? player.buffered.end(0):0;
            var progress = duration && end ? (end/duration):0;
            this.log('pre.progress',progress);
            if(progress > 0 && !this.firstPlay) {
                this.player.play();
            }
        },
        
        _handlePlayerPreTimeupdate: function(e) {
            var currentTime = this.player.currentTime || 0;
            this.log('pre.timeupdate',currentTime);
            var minLoadTime = this.player.duration < 0.5 ? this.player.duration:0.5;
            if(!this.firstPlay && currentTime > minLoadTime) {
                this.log('first timeupdate');
                this.firstPlay = true;
                this.resetPlayerCurrentTime();
                this.player.pause();
                if(this.player.pluginType === 'flash') {
                    this._handlePlayerReallyLoaded();
                } else if(this.canPlayThrough) {
                    this.canplayThroughTimeout = setTimeout(_.bind(function(){
                        
                        this.log('canplayThroughTimeout expired');
                        
                        this._handlePlayerReallyLoaded();
                        this.canplayThroughTimeout = null;
                        
                    },this), this.options.readyTimeout);
                }
            }
        },
        
        _handlePlayerReallyLoaded: function() {
            
            if(this.reallyLoaded) {
                return;
            }
            
            this.reallyLoaded = true;
            
            this.resetPlayer();
            this.bindPlayerEvents();
            
            this.log('player.reallyLoaded');
            
            window.setTimeout(_.bind(function() {
                this.trigger('player:loaded');
            },this),1);
        },
        
        _handlePlayerLoaded: function() {
            
            this.log('player.loaded');
        },
        
        _handlePlayerCanPlay: function() {
            
            this.log('player.canplay');
        },

        _handlePlayerPlay: function() {
            
            this.log('player.play');

            this.playing = true;
            this.paused = false;
            this._startTimeUpdateInterval();

            window.setTimeout(_.bind(function() {
                this.trigger('player:play');
            },this),1);

        },

        _handlePlayerPause: function() {
            
            this.log('player.pause');

            this.playing = false;
            this._stopTimeUpdateInterval();

            window.setTimeout(_.bind(function() {
                this.trigger('player:pause');
            },this),1);

        },

        _handlePlayerEnded: function() {

            this.playing = false;
            this.paused = false;
            this._stopTimeUpdateInterval();

            window.setTimeout(_.bind(function() {
                this.trigger('player:ended');

                if(this.options.loop) {
                    this.player.play();
                }
            },this),1);

        },
        
        _handleTimeUpdateInterval: function() {

            if(!this.player) {
                this._stopTimeUpdateInterval();
                return;
            }

            try {
                this.currentTime = this.player.currentTime;
            }catch(e){}

            this.trigger('player:timeupdate',this.currentTime);
            
            if(this.options.end && this.currentTime >= this.options.end) {
                this.stop();
                this._handlePlayerEnded();
            }

        },

        _handlePlayerTimeupdate: function() {

            try {
                this.currentTime = this.player.currentTime;
                //this.log('player.timeupdate',this.currentTime);
            }catch(e){}

            this.trigger('player:timeupdate',this.currentTime);

        },

        _handlePlayerError: function() {

            this.log('error',arguments);

        },
        
        log: function()
        {
            if(this.options.debug)
            {
                console.log.apply(console, arguments);
            }
        }

    });

    return VideoView;

});
