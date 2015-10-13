const PLUGIN_NAME = 'gulp-svg-icons';

var fs     = require('fs');
var path   = require('path');
var glob   = require('glob');
var extend = require('node.extend');
var gutil  = require('gulp-util');
var map    = require('map-stream');
var Error  = gutil.PluginError;

var error = function(right, message) {

	if (!right) {

		throw new Error(PLUGIN_NAME, message);
	}
};

var Icons = function(dir, options) {

	error(dir.constructor === String, 'Missing iconsDir option', true);
	error(fs.existsSync(dir), 'iconsDir path not found (' + dir + ')', true);

	var settings = extend({
		injectOnlyUsedIcons: true,
		prefix             : 'icon',
		placeholder        : '<!-- icons -->',
		style              : function(name) {

			return 'icon';
		},
		external           : function(name) {

			return '';
		}
	}, options);

	this.dir = dir;
	this.settings = settings;
	this.prefix = settings.prefix.constructor === String
		? function(name) {

			return settings.prefix + '-' + name;
		}
		: function(name) {

			return name;
		};

	this._init();
};

Icons.prototype._init = function(name) {

	var self = this;
	self._icons = ''; // All of the svg <symbol> elements, as a string, so it can be inserted between <svg> and </svg>
	self._collected = []; // list of svgs which have been collected into the _icons string

	if (!self.settings.injectOnlyUsedIcons) {

		glob.sync(path.join(self.dir, '*.svg')).forEach(function(file) {

			self._collect(path.basename(file, '.svg'));
		});
	}
};

Icons.prototype._collect = function(name) {

	var hasBeenCollected = (this._collected.indexOf(name) >= 0);
	// If we haven't collected this one yet, then do it now.
	if (!hasBeenCollected) {
		// get the svg file contents, reading it in synchronously ('Sync')
		var srcSVGStr = String(fs.readFileSync(path.join(this.dir, name + '.svg')));
		// Create a new <symbol> element, setting its viewBox attribute to what was specified in
		//  the source svg file, and setting its contents to be the source svg's contents (the content is between its <svg> and </svg>)
		// The new <symbol> element is added to the string of other <symbol>s.
		this._icons += [
			'<symbol id="',
			 this.prefix(name),
			 '" ',
			 // extract viewBox attribute from the source svg and put it on this <symbol>
			 /\s(viewBox="[0-9\-\s\.]+")/.exec(srcSVGStr)[1], // This blows up if there is no viewBox in the source svg file
			 '>',
			 // extract the source svg's content and set it as the content of this <symbol>
			 /<svg[^>]*>([\s\S]*?)<\/svg>/gi.exec(srcSVGStr)[1],
			 '</symbol>'
		 ].join('');

		 this._collected.push(name);
	}
};

Icons.prototype.replace = function() {

	var self  = this;

	return map(function(file, done) {

		var contents = String(file.contents);

		file.contents = new Buffer(contents.replace(/<icon-([a-z0-9\-]+)(?:\s+class="([a-z0-9\-\_ ]*)")?\/?>(?:\s*<\/icon-[a-z0-9\-]+>)?/gi, function(match, name, style) {

			style = style ? ' ' + style : '';

			if (self.settings.injectOnlyUsedIcons) {

				self._collect(name);
			}

			return [
				'<svg class="',
				self.settings.style(name),
				style,
				'"><use xlink:href="',
				self.settings.external(name),
				'#',
				self.prefix(name),
				'"></use></svg>'
			].join('');
		}));

		done(null, file);
	});
};

Icons.prototype.inject = function() {

	var self = this;
	var icons = '<svg style="display:none;">' + self._icons + '</svg>';

	var stream = map(function(file, done) {

		file.contents = new Buffer(
			String(file.contents)
			.replace(self.settings.placeholder, icons)
		);

		done(null, file);
	});

	stream.on('end', function() {

		self._init();
	});

	return stream;
};

module.exports = Icons;
