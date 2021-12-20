var uploadpeertube = (function () {
  var self = new nModule();

  var essenses = {};

  var ed = {};

  var Essense = function (p) {
    var primary = deep(p, 'history');

    var el, error;

    var wnd;
    var wndObj;

    var xhrRequest;

    var actions = {};

    var events = {
      validateFile: (file) =>
        new Promise((resolve, reject) => {
          var video = document.createElement('video');
          video.preload = 'metadata';

          video.onloadedmetadata = () => {
            window.URL.revokeObjectURL(video.src);

            

            

            resolve()

            /*// to bits and then to bitrate
            var averageBitrate = (8 * file.size) / video.duration;

            return averageBitrate > 8000000
              ? reject({
                  text: self.app.localization.e('videoBitrateError'),
                })
              : resolve();*/
          };

          video.src = URL.createObjectURL(file);
        }),
    };

    var renders = {};

    var videoId,
      loadedImage = null;

    var state = {
      save: function () {},
      load: function () {},
    };

    var initEvents = function () {

      el.c.find('.buypkoins').on('click', function(){

        self.closeContainer()

        self.nav.api.load({
          open : true,
          href : 'wallet',
          history : true,
          inWnd : true,

          essenseData : {
            simple : true,
            action : 'buy'
          }
        })

      })

      el.c.find('.tooltip').tooltipster({
        theme: 'tooltipster-light',
        maxWidth: 600,
        zIndex: 1006,
        position: 'bottom',
        contentAsHTML: true,
      });

      el.videoInput.change(function (evt) {
        var fileName = evt.target.files[0].name;

        el.videoError.text(
          fileName.slice(0, 20) + (fileName.length > 20 ? '...' : ''),
        );

        el.videoError.removeClass('error-message');
        var videoInputFile = el.videoInput.prop('files');
        var videoName = wnd.find('.upload-video-name').val();
        var nameError = wnd.find('.name-type-error');

        nameError.text('');

        console.log('videoInputFile[0].size', videoInputFile[0].size)

        if(videoInputFile[0].size > 4 * 1024 * 1024 * 1024){
          el.videoError.text(self.app.localization.e('videoSizeError'));
          el.videoError.addClass('error-message');

          return;
        }

        // validation
        if (!videoInputFile[0]) {
          el.videoError.text('No video selected');
          el.videoError.addClass('error-message');

          return;
        }

        if (!videoInputFile[0].type.includes('video')) {
          el.videoError.text('Incorrect video format');
          el.videoError.addClass('error-message');

          return;
        }

        ed.uploadInProgress = true;
        el.header.removeClass('activeOnRolled');
        el.uploadButton.prop('disabled', true);
        el.uploadProgress.removeClass('hidden');

        //var transcoded = await self.app.peertubeHandler.transcode(videoInputFile[0])

        var data = {
          //transcoded : transcoded,
          video: videoInputFile[0],
        };

        data.name = videoName || fileName;

        /**
         * Enumeration for Resolutions of videos
         * @type {{p720: string, p240: string, p360: string, p480: string}}
         */
        const Resolution = {
          p240: '352:240',
          p360: '640:360',
          p480: '854:480',
          p720: '1280:720',
        }

        /**
         * Video transcoder function
         *
         * @param {Buffer} inputBuff
         * @param {typeof Resolution} resolution
         *
         * @returns {Promise<Buffer>} result
         */
        function transcodeVideo(inputBuff, resolution) {
          function executor(resolve, reject) {
            let videoProcess;

            try {
              videoProcess = ffmpeg(inputBuff);
            } catch (err) {
              console.error('FFMPEG error occured', err);
            }

            function videoProcessor(video) {
              video.addCommand('-preset', 'veryfast');
              video.addCommand('-vf', `scale=${resolution}`);
              video.addCommand('-maxrate', '2000');

              const command = ffmpeg()
                  .input(inputBuff)
                  /*.videoCodec('libx264')
                  .audioCodec('aac')
                  .outputFormat('mp4')*/
                  .outputOptions([
                    '-preset veryfast',
                    `-vf scale=${resolution}`,
                    '-maxrate 2000'
                  ])
                  .pipe();

              const ffstream = command.pipe();

              let outputParts = [];

              ffstream.on('data', (chunk) => {
                console.log('ffmpeg just wrote ' + chunk.length + ' bytes');

                outputParts.push(chunk);
              });

              ffstream.on('end', () => {
                resolve(Buffer.concat(outputParts));
              });
            }

            function errorProcessor(err) {
              console.error('Error occured:', err);
              reject(err);
            }

            videoProcess.then(videoProcessor, errorProcessor);
          }

          return new Promise(executor);
        }

        let videoBuff;

        videoBuff = fs.readFileSync(data.video);

        /** Writing transcoded alternatives to target object */
        data.video = {
          p240: transcodeVideo(videoBuff, Resolution.p240),
          p360: transcodeVideo(videoBuff, Resolution.p360),
          p480: transcodeVideo(videoBuff, Resolution.p480),
          p720: transcodeVideo(videoBuff, Resolution.p720),
        };

        var options = {
          type: 'uploadVideo',
        };

        options.progress = function (percentComplete) {
          var formattedProgress = (percentComplete * 0.9).toFixed(2);

          if (
            formattedProgress === '100.00' &&
            el.preloaderElement.hasClass('hidden')
          ) {
            el.preloaderElement.removeClass('hidden');
          }

          el.uploadProgress
            .find('.upload-progress-bar')
            .css('width', formattedProgress + '%');
          el.uploadProgress
            .find('.upload-progress-percentage')
            .text(formattedProgress + '%');
        };

        options.cancel = function (cancel) {
          const cancelCloseFunction = () => {
            if (typeof cancel === 'function') cancel();

            wndObj.close();
          };

          ed.cancelCloseFunction = cancelCloseFunction;

          el.cancelButton.on('click', () => {
            el.uploadProgress.addClass('hidden');
            el.cancelButton.addClass('hidden');
            el.importUrl.removeClass('hidden');

            ed.uploadInProgress = false;
            cancel();
          });

          el.cancelButton.removeClass('hidden');
        };

        el.importUrl.addClass('hidden');

        self.app.peertubeHandler.api.videos
          .upload(data, options)
          .then((response) => {
            el.uploadButton.prop('disabled', false);
            el.header.addClass('activeOnRolled');
            el.uploadProgress.addClass('hidden');

            el.preloaderElement.addClass('hidden');

            ed.uploadInProgress = false;

            if (response.error) {
              return;
            }

            videoId = response.split('/').pop();

            actions.added(response, wnd.find('.upload-video-name').val());
            wndObj.close();
          })
          .catch((e = {}) => {
            console.error('Uploading error', e);

            el.videoInput.val('');
            el.wallpaperError.text('');

            el.uploadButton.prop('disabled', false);
            el.header.addClass('activeOnRolled');
            el.uploadProgress.addClass('hidden');

            if (e.cancel) {
              sitemessage('Uploading canceled');
            } else {
              var message =
                e.text ||
                findResponseError(e) ||
                `Uploading error: ${JSON.stringify(e)}`;

              sitemessage(message);
            }
          });

        console.log(data, options);
      });

      el.importUrl.click(() => {
        inputDialogNew({
          caption: self.app.localization.e('importHeading'),
          class: 'importVideoDialog',
          wrap: true,
          values: [
            {
              defValue: '',
              validate: 'empty',
              placeholder: self.app.localization.e('importInputPlaceholder'),
              label: self.app.localization.e('importInputLabel'),
            },
          ],

          success: function (v) {
            el.videoInput.prop('disabled', true);

            ed.uploadInProgress = true;
            el.header.removeClass('activeOnRolled');
            el.uploadButton.prop('disabled', true);
            el.uploadProgress.removeClass('hidden');

            var options = {
              type: 'importVideo',
            };

            options.progress = function (percentComplete) {
              var formattedProgress = (percentComplete * 0.9).toFixed(2);

              if (
                formattedProgress === '100.00' &&
                el.preloaderElement.hasClass('hidden')
              ) {
                el.preloaderElement.removeClass('hidden');
              }

              el.uploadProgress
                .find('.upload-progress-bar')
                .css('width', formattedProgress + '%');
              el.uploadProgress
                .find('.upload-progress-percentage')
                .text(formattedProgress + '%');
            };

            options.cancel = function (cancel) {
              const cancelCloseFunction = () => {
                if (typeof cancel === 'function') cancel();

                wndObj.close();
              };

              ed.cancelCloseFunction = cancelCloseFunction;

              el.cancelButton.on('click', () => {
                el.uploadProgress.addClass('hidden');
                el.cancelButton.addClass('hidden');
                el.importUrl.removeClass('hidden');

                el.videoInput.prop('disabled', false);

                ed.uploadInProgress = false;
                cancel();
              });

              el.cancelButton.removeClass('hidden');
            };

            el.importUrl.addClass('hidden');

            self.app.peertubeHandler.api.videos
              .import(
                {
                  data: { targetUrl: v[0] },
                },
                options,
              )
              .then((response) => {
                if (response.error) {
                  return;
                }

                videoId = response.split('/').pop();

                actions.added(response, wnd.find('.upload-video-name').val());
                ed.uploadInProgress = false;

                wndObj.close();
              })
              .catch((e = {}) => {
                el.videoInput.val('');
                el.wallpaperError.text('');

                el.uploadButton.prop('disabled', false);
                el.header.addClass('activeOnRolled');
                el.uploadProgress.addClass('hidden');

                el.importUrl.removeClass('hidden');
                el.videoInput.prop('disabled', false);

                ed.uploadInProgress = false;

                if (e.cancel) {
                  sitemessage('Uploading canceled');
                } else {
                  var message =
                    e.text ||
                    findResponseError(e) ||
                    `Uploading error: ${JSON.stringify(e)}`;

                  sitemessage(message);
                }
              });
          },
        });
      });
    };

    return {
      primary: primary,

      getdata: function (clbk, p) {
        ed = p.settings.essenseData;

        actions = ed.actions;

        var data = {
          hasAccess : false,
          increase : {}
        };

        error = false

        globalpreloader(true, true)

        self.app.peertubeHandler.api.user.me().then((res) => {

          data.hasAccess = true

          clbk(data);

        }).catch(e => {

          data.e = e
          error = true

          self.app.platform.sdk.ustate.canincrease({template : 'video'}, function(r){

            data.increase = r

            clbk(data);

          })

          

        }).then(() => {
          globalpreloader(false)
        })

       
      },

      destroy: function () {
        el = {};
      },

      init: function (p) {
        state.load();

        el = {};
        el.c = p.el.find('#' + self.map.id);
        el.videoInput = el.c.find('.upload-video-file');
        el.videoWallpaper = el.c.find('.upload-video-wallpaper');

        el.videoError = el.c.find('.file-type-error');
        el.wallpaperError = el.c.find('.wallpaper-type-error');

        el.videoLabel = el.c.find('.upload-video-file-label');
        el.wallpaperLabel = el.c.find('.upload-video-wallpaper-label');

        el.uploadProgress = el.c.find('.upload-progress-container');
        el.importUrl = el.c.find('.import-container');

        el.uploadButton = el.c.find('.uploadButton');
        el.cancelButton = el.c.find('.cancelButton');

        el.header = el.c.find('.upload-header');

        el.preloaderElement = el.c.find('.iconwr');

        initEvents();

        if(error) el.c.closest('.wnd').addClass('witherror')

        p.clbk(null, p);
      },

      wnd: {
        header: '',
        close: function () {
          if (ed.closeClbk) {
            ed.closeClbk();
          }
        },
        postRender: function (_wnd, _wndObj, clbk) {
          wndObj = _wndObj;
          wnd = _wnd;

          if (clbk) {
            clbk();
          }
        },
        offScroll: true,
        noInnerScroll: true,
        class: 'uploadpeertube normalizedmobile',
        allowHide: true,
        noCloseButton: true,
        noButtons: true,

        swipeClose: true,
        swipeCloseDir: 'right',
        swipeMintrueshold: 30,
      },
    };
  };

  self.run = function (p) {
    var essense = self.addEssense(essenses, Essense, p);

    self.init(essense, p);
  };

  self.stop = function () {
    _.each(essenses, function (essense) {
      essense.destroy();
    });
  };

  return self;
})();

if (typeof module != 'undefined') {
  module.exports = uploadpeertube;
} else {
  app.modules.uploadpeertube = {};
  app.modules.uploadpeertube.module = uploadpeertube;
}
