/*
Copyright (c) 2011-2013 @WalmartLabs

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to
deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
*/

;;
(function() {

/*global $serverSide, FruitLoops */

// Override uniqueId to ensure uniqueness across both the server and client
// rendering cycles
var _idCounter = window._idCounter || 0,
    _reqId = '';
window._resetIdCounter = function(reqId) {
  _idCounter = 0;
  _reqId = reqId || '';
};

_.uniqueId = function(prefix) {
  var id = _reqId + (++_idCounter);
  return prefix ? prefix + id : id;
};

if (window.$serverSide) {
  FruitLoops.onEmit(function() {
    $('body').append('<script>window._idCounter = ' + _idCounter + ';</script>');
  });
}

;;
/*global
    Thorax:true,
    $serverSide,
    assignTemplate, createError, createInheritVars, createRegistryWrapper, getValue,
    inheritVars, resetInheritVars,
    Deferrable, ServerMarshal
*/

// Provide default behavior for client-failover
if (typeof $serverSide === 'undefined') {
  window.$serverSide = false;
}

var isIE11 = !!navigator.userAgent.match(/Trident\/7\./);
var isIE = isIE11 || (/msie [\w.]+/).exec(navigator.userAgent.toLowerCase());

//support zepto.forEach on jQuery
if (!$.fn.forEach) {
  $.fn.forEach = function(iterator, context) {
    $.fn.each.call(this, function(index) {
      iterator.call(context || this, this, index);
    });
  };
}

var setImmediate = window.setImmediate || function(callback) {
  setTimeout(callback, 0);
};

var viewNameAttributeName = 'data-view-name',
    viewCidAttributeName = 'data-view-cid',
    viewHelperAttributeName = 'data-view-helper',

    // Used to identify views that can be restored vs. rerendered on the client side.
    // Values are:
    //  - true - Can be restored
    //  - false - Must be rerendered
    //  - Omitted - Normal HTML element without associated view
    viewRestoreAttribute = 'data-view-restore';

//view instances
var viewsIndexedByCid = {};

if (!Handlebars.templates) {
  Handlebars.templates = {};
}

var Thorax = this.Thorax = {
  templatePathPrefix: '',
  //view classes
  Views: {},

  // Allows tagging of sections of code with a name for debugging purposes.
  // This or onException should be overriden to allow for reporting exceptions to analytics servers
  // or integration with libraries such as Costanza.
  bindSection: function(name, info, callback) {
    if (!callback) {
      callback = info;
      info = undefined;
    }
    if (Thorax.onException) {
      return function() {
        try {
          return callback.apply(this, arguments);
        } catch (err) {
          Thorax.onException(name, err, info);
        }
      };
    }
    else {
      return callback;
    }
  },
  runSection: function(name, info, callback) {
    return Thorax.bindSection(name, info, callback)();
  },

  onException: null,

  //deprecated, here to ensure existing projects aren't mucked with
  templates: Handlebars.templates
};

Thorax.View = Backbone.View.extend({
  constructor: function ThoraxView(options) {
    // store first argument for configureView()
    this._constructorArg = options;
    var response = Backbone.View.call(this, options);
    this._constructorArg = undefined;

    _.each(inheritVars, function(obj) {
      if (obj.ctor) {
        obj.ctor(this, response);
      }
    }, this);
    return response;
  },

  toString: function() {
    return '[object View.' + this.name + ']';
  },

  // View configuration, _configure was removed
  // in Backbone 1.1, define _configure as a noop
  // for Backwards compatibility with 1.0 and earlier
  _configure: function() {},
  _ensureElement: function () {
    configureView(this);

    if (!$serverSide && this.el) {
      var $el = $(_.result(this, 'el'));
      if ($el.length && ($el.attr('data-view-restore') === 'true')) {
        return this.restore($el);
      }
    }

    return Backbone.View.prototype._ensureElement.call(this);
  },


  setElement : function(element, delegate) {
    var $element = $(element),
        existingCid = $element.attr('data-view-cid');
    if (existingCid) {
      this._assignCid(existingCid);
    }
    var response = Backbone.View.prototype.setElement.call(this, $element, delegate);

    // Use a hash here to avoid multiple DOM operations
    var attr = {'data-view-cid': this.cid};
    if (this.name) {
      attr[viewNameAttributeName] = this.name;
    }
    this.$el.attr(attr);

    if (element.parentNode) {
      // This is a view that is attaching to an existing node and is unlikely to be added as
      // a children of any views. Assume that anyone doing this will manage the lifecycle
      // appropriately and destroy so we don't leak due to the `$.view` lookup that we are
      // registering here.
      this.retain();
    }

    return response;
  },
  _assignCid: function(cid) {
    if (this.cid && viewsIndexedByCid[this.cid]) {
      delete viewsIndexedByCid[this.cid];
      viewsIndexedByCid[cid] = this;
    }

    if (this.parent) {
      delete this.parent.children[this.cid];
      this.parent.children[cid] = this;
    }

    this.cid = cid;
  },

  _addChild: function(view) {
    if (this.children[view.cid]) {
      return view;
    }

    view.retain();
    this.children[view.cid] = view;
    // _helperOptions is used to detect if is HelperView
    // we do not want to remove child in this case as
    // we are adding the HelperView to the declaring view
    // (whatever view used the view helper in it's template)
    // but it's parent will not equal the declaring view
    // in the case of a nested helper, which will cause an error.
    // In either case it's not necessary to ever call
    // _removeChild on a HelperView as _addChild should only
    // be called when a HelperView is created.
    if (view.parent && view.parent !== this && !view._helperOptions) {
      view.parent._removeChild(view);
    }
    view.parent = this;
    this.trigger('child', view);
    return view;
  },

  _removeChild: function(view) {
    delete this.children[view.cid];
    view.parent = null;
    view.release();
    return view;
  },

  _destroy: function() {
    this.trigger('destroyed');
    delete viewsIndexedByCid[this.cid];

    this.stopListening();
    this.off();

    _.each(this.children, function(child) {
      child.parent = null;
      child.release();
    });

    if (this.el) {
      this.undelegateEvents();
      this.$el.remove();

      ServerMarshal.destroy(this.$el);
    }

    // Absolute worst case scenario, kill off some known fields to minimize the impact
    // of being retained.
    this.el = this.$el =
      this.parent = this.children =
      this.model = this.collection = this._collection =
      this._boundDataObjectsByCid = this._objectOptionsByCid =
      this._helperOptions = undefined;
  },

  restore: function(element, forceRerender) {
    // Extract from $ objects if passed
    element = element[0] || element;

    if (this._renderCount) {
      // Ensure that we are registered to the right cid (this could have been reset previously)
      var oldCid = this.$el.attr('data-view-cid');
      if (this.cid !== oldCid) {
        this._assignCid(oldCid);
      }

      $(element).replaceWith(this.$el);

      this.trigger('restore:fail', {
        type: 'previously-rendered',
        view: this,
        element: element
      });
      return;
    }

    this.setElement(element);

    var restoreable = this.$el.attr('data-view-restore') === 'true';
    this.$el.removeAttr('data-view-restore');

    if (!$serverSide && restoreable) {
      // Ensure that our associated template is wired up so that helpers who need to
      // resolve template children are able to do so.
      assignTemplate(this, 'template', {
        required: false
      });

      this._renderCount = 1;
      this.trigger('restore', forceRerender);

      if (forceRerender) {
        // We have an explicit rerender that we wanted to defer until the end of the restore process
        this.render();
      } else {
        // Check to see if we are in a partial restore situation
        var remainingViews = this.$('[data-view-restore]'),
            rerender = _.filter(remainingViews, function(el) {
              // Ignore views that are deeply nested or views that are under a layout element
              // when checking to see if we need to rerender.
              var parent = $(el).parent();
              return !parent.attr('data-layout-cid') && (parent.view({el: true, helper: true})[0] === element);
            });
        if (rerender.length) {
          this.trigger('restore:fail', {
            type: 'remaining',
            view: this,
            element: element,
            rerendered: rerender
          });

          this.render();
        }
      }

      this.trigger('after-restore', forceRerender);

      return true;
    } else {
      this.trigger('restore:fail', {
        type: 'not-restorable',
        view: this,
        element: element
      });

      this.render();
    }
  },

  render: function(output, callback) {
    var self = this;
    // NOP for destroyed views
    if (!self.el) {
      return self;
    }

    Thorax.runSection('thorax-render', {name: self.name}, function render() {
      if (self._rendering) {
        // Nested rendering of the same view instances can lead to some very nasty issues with
        // the root render process overwriting any updated data that may have been output in the child
        // execution. If in a situation where you need to rerender in response to an event that is
        // triggered sync in the rendering lifecycle it's recommended to defer the subsequent render
        // or refactor so that all preconditions are known prior to exec.
        throw createError('nested-render');
      }

      self._rendering = true;

      var deferrable = new Deferrable(callback),
          children = {},
          previous = [];

      _.each(self.children, function(child, key) {
        if (!child._helperOptions) {
          children[key] = child;
        } else {
          child._cull = true;
          previous.push(child);
        }
      });
      self.children = children;
      self._previousHelpers = previous;

      // Emulating triggerDeferrable here, without creating a separate deferrable context
      self.trigger('before:rendered', deferrable);
      deferrable.exec(function() {
        if (_.isUndefined(output) || (!_.isElement(output) && !Thorax.Util.is$(output) && !(output && output.el) && !_.isString(output) && !_.isFunction(output))) {
          // try one more time to assign the template, if we don't
          // yet have one we must raise
          assignTemplate(self, 'template', {
            required: true
          });
          output = self.renderTemplate(self.template);
        } else if (_.isFunction(output)) {
          output = self.renderTemplate(output);
        }
      });

      deferrable.exec(function() {
        // Destroy any helpers that may be lingering
        _.each(previous, function(child) {
          if (child._cull) {
            self._removeChild(child);
          }
        });
        self._previousHelpers = undefined;

        if ($serverSide) {
          if (self.$el.attr(viewRestoreAttribute) !== 'false') {
            self.$el.attr(viewRestoreAttribute, $serverSide);
          }
        } else {
          self.$el.removeAttr(viewRestoreAttribute);
        }
      });

      deferrable.chain(function(next) {
        //accept a view, string, Handlebars.SafeString or DOM element
        self.html((output && output.el) || (output && output.string) || output, next);
      });

      deferrable.exec(function() {
        ++self._renderCount;

        self.trigger('rendered');
        self._rendering = false;
      });
      deferrable.run();
    });

    return self;
  },

  context: function() {
    return this.model && this.model.attributes;
  },

  _getContext: function() {
    var context = Object.create ? Object.create(this) : _.clone(this);
    return _.extend(context, this.context.call ? this.context() : this.context);
  },

  // Private variables in handlebars / options.data in template helpers
  _getData: function(data) {
    return {
      view: this,
      root: data,
      cid: _.uniqueId('t'),
      yield: function() {
        // fn is seeded by template helper passing context to data
        return data.fn && data.fn(data);
      }
    };
  },

  renderTemplate: function(file, context, ignoreErrors) {
    var template;
    if (_.isFunction(file)) {
      template = file;
    } else {
      template = Thorax.Util.getTemplate(file, ignoreErrors);
    }
    if (!template || template === Handlebars.VM.noop) {
      return '';
    } else {
      context = context || this._getContext();

      return template(context, {
        helpers: this.helpers,
        data: this._getData(context)
      });
    }
  },

  ensureRendered: function(callback) {
    if (!this._renderCount) {
      this.render(undefined, callback);
    } else if (callback) {
      setImmediate(callback);
    }
  },
  shouldRender: function(flag) {
    // Render if flag is truthy or if we have already rendered and flag is undefined/null
    return flag || (flag == null && this._renderCount);
  },
  conditionalRender: function(flag) {
    if (this.shouldRender(flag)) {
      this.render();
    }
  },

  appendTo: function(el) {
    this.ensureRendered();
    $(el).append(this.el);
    this.trigger('ready', {target: this});
  },

  html: function(html, callback) {
    if (_.isUndefined(html)) {
      return this.$el.html();
    } else {
      this.trigger('before:append');
      var element = this._replaceHTML(html);
      this.triggerDeferrable('append', undefined, undefined, callback);
      return element;
    }
  },

  release: function() {
    --this._referenceCount;
    if (this._referenceCount <= 0) {
      this._destroy();
    }
  },

  retain: function(owner) {
    if (!viewsIndexedByCid[this.cid]) {
      // Register with the `$.view` helper.
      viewsIndexedByCid[this.cid] = this;
    }

    ++this._referenceCount;
    if (owner) {
      // Not using listenTo helper as we want to run once the owner is destroyed
      this.listenTo(owner, 'destroyed', owner.release);
    }
  },

  _replaceHTML: function(html) {
    // We want to pull our elements out of the tree if we are under jQuery
    // or IE as both have the tendancy to mangle the elements we want to reuse
    // on cleanup. This could leak event binds if users are performing custom binds
    // but this generally not recommended.
    if (this._renderCount && (isIE || $.fn.jquery)) {
      while (this.el.hasChildNodes()) {
        this.el.removeChild(this.el.childNodes[0]);
      }
    }

    this.$el.empty();
    return this.$el.append(html);
  },

  _anchorClick: function(event) {
    var target = $(event.currentTarget),
        href = target.attr('href');

    // Don't push if meta or shift key are clicked
    if (event.metaKey || event.shiftKey) {
      return true;
    }

    // Route anything that starts with # or / (excluding //domain urls)
    if (href && (href[0] === '#' || (href[0] === '/' && href[1] !== '/'))) {
      Backbone.history.navigate(href, {
        trigger: true
      });
      return false;
    }
    return true;
  }
});

Thorax.View.extend = function() {
  createInheritVars(this);

  var child = Backbone.View.extend.apply(this, arguments);
  child.__parent__ = this;

  resetInheritVars(child);

  return child;
};

createRegistryWrapper(Thorax.View, Thorax.Views);

function configureView(view) {
  var options = view._constructorArg;

  view._referenceCount = 0;

  view._objectOptionsByCid = {};
  view._boundDataObjectsByCid = {};

  // Setup object event tracking
  _.each(inheritVars, function(obj) {
    view[obj.name] = [];
  });

  view.children = {};
  view._renderCount = 0;

  //this.options is removed in Thorax.View, we merge passed
  //properties directly with the view and template context
  if (options) {
    _.extend(view, options);
  }

  // Setup helpers
  bindHelpers(view);

  _.each(inheritVars, function(obj) {
    if (obj.configure) {
      obj.configure(view);
    }
  });

  view.trigger('configure');
}

function bindHelpers(view) {
  if (view.helpers) {
    _.each(view.helpers, function(helper, name) {
      view.helpers[name] = function() {
        var args = _.toArray(arguments),
            options = _.last(args);
        options.context = this;
        return helper.apply(view, args);
      };
    });
  }
}

//$(selector).view() helper
$.fn.view = function(options) {
  options = _.defaults(options || {}, {
    helper: true
  });
  var selector = '[' + viewCidAttributeName + ']';
  if (!options.helper) {
    selector += ':not([' + viewHelperAttributeName + '])';
  }
  var el = $(this).closest(selector);
  if (el) {
    if (options.el) {
      return el;
    } else {
      var cid = el.attr(viewCidAttributeName),
          view = viewsIndexedByCid[cid];
      if (!view) {
        throw createError('fn-view-unregistered');
      }
      return view;
    }
  } else {
    return false;
  }
};

;;
/*global createRegistryWrapper:true, getEventCallback */

function createErrorMessage(code) {
  return 'Error "' + code + '". For more information visit http://thoraxjs.org/error-codes.html' + '#' + code;
}
function createError(code, info) {
  var error = new Error(createErrorMessage(code));
  error.name = code;
  error.info = info;
  return error;
}

function createRegistryWrapper(klass, hash) {
  var $super = klass.extend;
  klass.extend = function() {
    var child = $super.apply(this, arguments);
    if (child.prototype.name) {
      hash[child.prototype.name] = child;
    }
    return child;
  };
}

function registryGet(object, type, name, ignoreErrors) {
  var target = object[type],
      value;
  if (_.indexOf(name, '.') >= 0) {
    var bits = name.split(/\./);
    name = bits.pop();
    _.each(bits, function(key) {
      target = target[key];
    });
  }
  target && (value = target[name]);
  if (!value && !ignoreErrors) {
    throw new Error(type + ': ' + name + ' does not exist.');
  } else {
    return value;
  }
}


function assignView(view, attributeName, options) {
  var ViewClass;
  // if attribute is the name of view to fetch
  if (_.isString(view[attributeName])) {
    ViewClass = Thorax.Util.getViewClass(view[attributeName], true);
  // else try and fetch the view based on the name
  } else if (view.name && !_.isFunction(view[attributeName])) {
    ViewClass = Thorax.Util.getViewClass(view.name + (options.extension || ''), true);
  }
  // if we found something, assign it
  if (ViewClass && !_.isFunction(view[attributeName])) {
    view[attributeName] = ViewClass;
  }
  // if nothing was found and it's required, throw
  if (options.required && !_.isFunction(view[attributeName])) {
    throw new Error('View ' + (view.name || view.cid) + ' requires: ' + attributeName);
  }
}

function assignTemplate(view, attributeName, options) {
  var template;
  // if attribute is the name of template to fetch
  if (_.isString(view[attributeName])) {
    template = Thorax.Util.getTemplate(view[attributeName], true);
  // else try and fetch the template based on the name
  } else if (view.name && !_.isFunction(view[attributeName])) {
    template = Thorax.Util.getTemplate(view.name + (options.extension || ''), true);
  }
  // CollectionView and LayoutView have a defaultTemplate that may be used if none
  // was found, regular views must have a template if render() is called
  if (!template && attributeName === 'template' && view._defaultTemplate) {
    template = view._defaultTemplate;
  }
  // if we found something, assign it
  if (template && !_.isFunction(view[attributeName])) {
    view[attributeName] = template;
  }
  // if nothing was found and it's required, throw
  if (options.required && !_.isFunction(view[attributeName])) {
    var err = new Error('view-requires: ' + attributeName);
    err.info = {
      name: view.name || view.cid,
      parent: view.parent && (view.parent.name || view.parent.cid),
      helperName: view._helperName
    };
    throw err;
  }
}

// getValue is used instead of _.result because we
// need an extra scope parameter, and will minify
// better than _.result
function getValue(object, prop, scope) {
  prop = object && object[prop];
  return prop && prop.call ? prop.call(scope || object) : prop;
}

var inheritVars = {};
function createInheritVars(self) {
  // Ensure that we have our static event objects
  _.each(inheritVars, function(obj) {
    if (!self[obj.name]) {
      self[obj.name] = [];
    }
  });
}
function resetInheritVars(self) {
  // Ensure that we have our static event objects
  _.each(inheritVars, function(obj) {
    self[obj.name] = [];
  });
}
function walkInheritTree(source, fieldName, isStatic, callback) {
  /*jshint boss:true */
  var tree = [];
  if (_.has(source, fieldName)) {
    tree.push(source);
  }
  var iterate = source;
  if (isStatic) {
    while (iterate = iterate.__parent__) {
      if (_.has(iterate, fieldName)) {
        tree.push(iterate);
      }
    }
  } else {
    iterate = iterate.constructor;

    // Iterate over all prototypes exclusive of the backbone view prototype
    while (iterate && iterate.__super__) {
      if (iterate.prototype && _.has(iterate.prototype, fieldName)) {
        tree.push(iterate.prototype);
      }
      iterate = iterate.__super__ && iterate.__super__.constructor;
    }
  }

  var i = tree.length;
  while (i--) {
    _.each(getValue(tree[i], fieldName, source), callback);
  }
}

function objectEvents(target, eventName, callback, context) {
  if (_.isObject(callback)) {
    var spec = inheritVars[eventName];
    if (spec && spec.event) {
      if (target && target.listenTo && target[eventName] && target[eventName].cid) {
        addEvents(target, callback, context, eventName);
      } else {
        addEvents(target['_' + eventName + 'Events'], callback, context);
      }
      return true;
    }
  }
}
// internal listenTo function will error on destroyed
// race condition
function listenTo(object, target, eventName, callback, context) {
  // getEventCallback will resolve if it is a string or a method
  // and return a method
  var callbackMethod = getEventCallback(callback, object),
      destroyedCount = 0;

  function eventHandler() {
    if (object.el) {
      callbackMethod.apply(context, arguments);
    } else {
      // If our event handler is removed by destroy while another event is processing then we
      // we might see one latent event percolate through due to caching in the event loop. If we
      // see multiple events this is a concern and a sign that something was not cleaned properly.
      if (destroyedCount) {
        throw new Error('destroyed-event:' + object.name + ':' + eventName);
      }
      destroyedCount++;
    }
  }
  eventHandler._callback = callbackMethod._callback || callbackMethod;
  eventHandler._thoraxBind = true;
  object.listenTo(target, eventName, eventHandler);
}

function addEvents(target, source, context, listenToObject) {
  function addEvent(callback, eventName) {
    if (listenToObject) {
      listenTo(target, target[listenToObject], eventName, callback, context || target);
    } else {
      target.push([eventName, callback, context]);
    }
  }

  _.each(source, function(callback, eventName) {
    if (_.isArray(callback)) {
      _.each(callback, function(cb) {
        addEvent(cb, eventName);
      });
    } else {
      addEvent(callback, eventName);
    }
  });
}

// In helpers "tagName" or "tag" may be specified, as well
// as "class" or "className". Normalize to "tagName" and
// "className" to match the property names used by Backbone
// jQuery, etc. Special case for "className" in
// Thorax.Util.tag: will be rewritten as "class" in
// generated HTML.
function normalizeHTMLAttributeOptions(options) {
  if (options.tag) {
    options.tagName = options.tag;
    delete options.tag;
  }
  if (options['class']) {
    options.className = options['class'];
    delete options['class'];
  }
}

var voidTags;
function isVoidTag(tag) {
  if (!voidTags) {
    // http://www.w3.org/html/wg/drafts/html/master/syntax.html#void-elements
    var tags = 'area,base,br,col,embed,hr,img,input,keygen,link,menuitem,meta,param,source,track,wbr';

    voidTags = {};
    _.each(tags.split(','), function(tag) {
      voidTags[tag] = true;
    });
  }

  return voidTags[tag];
}

function filterAncestors(parent, callback) {
  return function() {
    if ($(this).parent().view({el: true, helper: true})[0] === parent.el) {
      return callback.call(this);
    }
  };
}

Thorax.Util = {
  getViewInstance: function(name, attributes) {
    var ViewClass = Thorax.Util.getViewClass(name, true);
    return ViewClass ? new ViewClass(attributes || {}) : name;
  },

  getViewClass: function(name, ignoreErrors) {
    if (_.isString(name)) {
      return registryGet(Thorax, 'Views', name, ignoreErrors);
    } else if (_.isFunction(name)) {
      return name;
    } else {
      return false;
    }
  },

  getTemplate: function(file, ignoreErrors) {
    if (_.isFunction(file)) {
      return file;
    }

    //append the template path prefix if it is missing
    var pathPrefix = Thorax.templatePathPrefix,
        template;
    if (pathPrefix && file.substr(0, pathPrefix.length) !== pathPrefix) {
      file = pathPrefix + file;
    }

    // Without extension
    file = file.replace(/\.handlebars$/, '');
    template = Handlebars.templates[file];
    if (!template) {
      // With extension
      file = file + '.handlebars';
      template = Handlebars.templates[file];
    }

    if (!template && !ignoreErrors) {
      throw new Error('templates: ' + file + ' does not exist.');
    }
    return template;
  },

  //'selector' is not present in $('<p></p>')
  //TODO: investigage a better detection method
  is$: function(obj) {
    return _.isObject(obj) && ('length' in obj);
  },
  expandToken: function(input, scope, encode) {
    /*jshint boss:true */

    if (input && input.indexOf && input.indexOf('{{') >= 0) {
      var re = /(?:\{?[^{]+)|(?:\{\{([^}]+)\}\})/g,
          match,
          ret = [];
      function deref(token, scope) {
        if (token.match(/^("|')/) && token.match(/("|')$/)) {
          return token.replace(/(^("|')|('|")$)/g, '');
        }
        var segments = token.split('.'),
            len = segments.length;
        for (var i = 0; scope && i < len; i++) {
          if (segments[i] !== 'this') {
            scope = scope[segments[i]];
          }
        }
        if (encode && _.isString(scope)) {
          return encodeURIComponent(scope);
        } else {
          return scope;
        }
      }
      while (match = re.exec(input)) {
        if (match[1]) {
          var params = match[1].split(/\s+/);
          if (params.length > 1) {
            var helper = params.shift();
            params = _.map(params, function(param) { return deref(param, scope); });
            if (Handlebars.helpers[helper]) {
              ret.push(Handlebars.helpers[helper].apply(scope, params));
            } else {
              // If the helper is not defined do nothing
              ret.push(match[0]);
            }
          } else {
            ret.push(deref(params[0], scope));
          }
        } else {
          ret.push(match[0]);
        }
      }
      input = ret.join('');
    }
    return input;
  },
  tag: function(attributes, content, scope) {
    var tag = attributes.tagName || 'div',
        noClose = isVoidTag(tag);

    if (noClose && content) {
      throw new Error(createErrorMessage('void-tag-content'));
    }

    var openingTag = '<' + tag + ' ' + _.map(attributes, function(value, key) {
      if (value == null || key === 'expand-tokens' || key === 'tagName') {
        return '';
      }
      var formattedValue = value;
      if (scope) {
        formattedValue = Thorax.Util.expandToken(value, scope);
      }
      return (key === 'className' ? 'class' : key) + '="' + Handlebars.Utils.escapeExpression(formattedValue) + '"';
    }).join(' ') + '>';

    if (noClose) {
      return openingTag;
    } else {
      return openingTag + (content == null ? '' : content) + '</' + tag + '>';
    }
  }
};

;;
/*global setImmediate */

// Provides a sync/async task runner that allows for operations to run in the
// best mode for their current environment. This is primarily intended for use
// in server side (async) vs. client side (sync) operations but code utilizing
// this should not make assumptions about one state or another.
//
// When `complete` is is a callback passed, all of the tasks will be executed
// asynchronously. If this parameter is omitted, then all tasks will be executed
// synchronously.
//
// All callbacks to `exec`/`chain` are guaranteed to execute in the order that they
// were received. All operations will be run when the `run` call is made, meaning
// the normal code interleaved with deferrable tasks will run before the deferrable
// task. Generally it's not recommended to mix and match the two code styles
// outside of initialization logic.
function Deferrable(complete) {
  var queue = [];

  function next() {
    if (complete) {
      setImmediate(function() {
        // Run the task
        var callback = queue.shift();
        if (callback) {
          callback();
        } else {
          // If this is the last task then complete the overall operation
          complete();
        }
      });
    } else {
      /*jshint boss:true */
      var callback;
      while (callback = queue.shift()) {
        callback();
      }
    }
  }

  return {
    // Registers a task that will always be complete after it returns.
    // Execution of subsequent tasks is automatic.
    exec: function(callback) {
      queue.push(function() {
        callback();

        if (complete) {
          next();
        }
      });
    },

    // Registers a task that may optionally defer to another deferrable stack.
    // When in async mode the task will recieve a callback to execute further
    // tasks after this one is completed.
    // 
    // Note that this is not intended for allowing a true async behavior and
    // should only be used to execute additional deferrable chains.
    chain: function(callback) {
      queue.push(function() {
        if (complete) {
          callback(next);
        } else {
          callback();
        }
      });
    },

    // Signal that all potential tasks have been registered and execution should
    // commence.
    run: function() {
      // Check if there were no asyncable calls made and complete immediately
      if (complete && !queue.length) {
        setImmediate(complete);
      } else {
        // Otherwise fire off the async processes
        next();
      }
    }
  };
}
Thorax.Util.Deferrable = Deferrable;

// Executes an event loop chain with an attached deferrable as the final argument.
// This method expects a final argument to be the callback for the deferrable or
// explicitly undefined. If in a situation where it's known ahead of time that
// there will be no callback value then `trigger` should be used directly.
Thorax.View.prototype.triggerDeferrable = function() {
  var args = [],
      len = arguments.length - 1,
      callback = arguments[len];
  for (var i = 0; i < len; i++) {
    args.push(arguments[i]);
  }

  var controller = new Deferrable(callback);
  args.push(controller);

  this.trigger.apply(this, args);
  controller.run();
};

;;
/*global $serverSide, createError, FruitLoops */
var _thoraxServerData = window._thoraxServerData || [];

/*
 * Allows for complex data to be communicated between the server and client
 * contexts for an arbitrary element.
 *
 * This is primarily intended for resolving template associated data on the client
 * but any data can be expressed via simple paths from a known root object, such
 * as a view instance or it's rendering context, may be marshaled.
 */
var ServerMarshal = Thorax.ServerMarshal = {
  store: function($el, name, data, dataIds, options) {
    if (!$serverSide) {
      return;
    }

    dataIds = dataIds || {};

    options = (options && options.data) || options || {};

    // Find or create the lookup table element
    var elementCacheId = $el._serverData || parseInt($el.attr('data-server-data'), 10);
    if (isNaN(elementCacheId)) {
      elementCacheId = _thoraxServerData.length;
      _thoraxServerData[elementCacheId] = {};

      $el._serverData = elementCacheId;
      $el.attr('data-server-data', elementCacheId);
    }

    var cache = _thoraxServerData[elementCacheId];
    cache[name] = undefined;

    // Store whatever data that we have
    if (_.isArray(data) && !_.isString(dataIds) && !data.toJSON) {
      if (data.length) {
        cache[name] = _.map(data, function(value, key) {
          return lookupValue(value, dataIds[key], options);
        });
      }
    } else if (_.isObject(data) && !_.isString(dataIds) && !data.toJSON) {
      var stored = {},
          valueSet;
      _.each(data, function(value, key) {
        stored[key] = lookupValue(value, dataIds[key], options);
        valueSet = true;
      });
      if (valueSet) {
        cache[name] = stored;
      }
    } else {
      // We were passed a singular value (attributeId is a simple id value)
      cache[name] = lookupValue(data, dataIds, options);
    }
  },
  load: function(el, name, parentView, context) {
    var elementCacheId = parseInt(el.getAttribute('data-server-data'), 0),
        cache = _thoraxServerData[elementCacheId];
    if (!cache) {
      return;
    }

    function resolve(value) {
      return (value && value.$lut != null) ? lookupField(parentView, context, value.$lut) : value;
    }

    cache = cache[name];
    if (_.isArray(cache)) {
      return _.map(cache, resolve);
    } else if (!_.isFunction(cache) && _.isObject(cache) && cache.$lut == null) {
      var ret = {};
      _.each(cache, function(value, key) {
        ret[key] = resolve(value);
      });
      return ret;
    } else {
      return resolve(cache);
    }
  },

  serialize: function() {
    if ($serverSide) {
      return JSON.stringify(_thoraxServerData);
    }
  },

  destroy: function($el) {
    /*jshint -W035 */
    var elementCacheId = parseInt($el.attr('data-server-data'), 10);
    if (!isNaN(elementCacheId)) {
      _thoraxServerData[elementCacheId] = undefined;

      // Reclaim whatever slots that we can. This ensures a smaller output structure while avoiding
      // conflicts that may occur when operating in a shared environment.
      var len = _thoraxServerData.length;
      while (len-- && !_thoraxServerData[len]) { /* NOP */ }
      if (len < _thoraxServerData.length - 1) {
        _thoraxServerData.length = len + 1;
      }
    }
  },

  _reset: function() {
    // Intended for tests only
    _thoraxServerData = [];
  }
};

// Register a callback to output our content from the server implementation.
if ($serverSide) {
  FruitLoops.onEmit(function() {
    $('body').append('<script>var _thoraxServerData = ' + ServerMarshal.serialize() + ';</script>');
  });
}

/*
 * Walks a given parent or context scope, attempting to resolve a dot
 * separated path.
 *
 * The parent context is given priority.
 */
function lookupField(parent, context, fieldName) {
  function lookup(context) {
    for (var i = 0; context && i < components.length; i++) {
      if (components[i] !== '' && components[i] !== '.' && components[i] !== 'this') {
        context = context[components[i]];
      }
    }
    return context;
  }

  var components = fieldName.split('.');
  return lookup(context) || lookup(parent);
}

/*
 * Determines the value to be saved in the lookup table to be restored on the client.
 */
function lookupValue(value, lutKey, data) {
  if (_.isString(value) || _.isNumber(value) || _.isNull(value) || _.isBoolean(value)) {
    return value;
  } else if (lutKey != null && lutKey !== true && !/^\.\.\//.test(lutKey)) {
    // This is an object what has a path associated with it so we should hopefully
    // be able to resolve it on the client.
    var contextPath = Handlebars.Utils.appendContextPath(data.contextPath, lutKey);
    if (lookupField(data.view, data.root, contextPath) === value) {
      return {
        $lut: contextPath
      };
    }
  }

  // This is some sort of unsuppored object type or a depthed reference (../foo)
  // which is not supported.
  throw createError('server-marshall-object');
}

;;
Thorax.Mixins = {};

_.extend(Thorax.View, {
  mixin: function(name) {
    Thorax.Mixins[name](this);
  },
  registerMixin: function(name, callback, methods) {
    Thorax.Mixins[name] = function(obj) {
      var isInstance = !!obj.cid;
      if (methods) {
        _.extend(isInstance ? obj : obj.prototype, methods);
      }
      if (isInstance) {
        callback.call(obj);
      } else {
        obj.on('configure', callback);
      }
    };
  }
});

Thorax.View.prototype.mixin = function(name) {
  Thorax.Mixins[name](this);
};

;;
/*global $serverSide, createInheritVars, inheritVars, listenTo, objectEvents, walkInheritTree */
// Save a copy of the _on method to call as a $super method
var _on = Thorax.View.prototype.on;

var eventSplitter = /^(nested\s+)?(\S+)(?:\s+(.+))?/;

var domEvents = {},
    eventParamsCache = {};

(function(events) {
  _.each(events, function(event) { domEvents[event] = true; });
})([
  'touchstart', 'touchmove', 'touchend', 'touchcancel',
  'mouseenter', 'mouseleave', 'mousemove', 'mousedown', 'mouseup', 'mouseover', 'mouseout',
  'keydown', 'keyup', 'keypress',
  'contextmenu',
  'click', 'dblclick',
  'focusin', 'focusout', 'focus', 'blur',
  'submit', 'input', 'change',
  'dragstart', 'drag', 'dragenter', 'dragleave', 'dragover', 'drop', 'dragend',

  'singleTap', 'doubleTap', 'longTap',
  'swipe',
  'swipeUp', 'swipeDown',
  'swipeLeft', 'swipeRight'
]);

inheritVars.event = {
  name: '_events',

  configure: function(self) {
    walkInheritTree(self.constructor, '_events', true, function(event) {
      self.on.call(self, event[0], event[1]);
    });
    walkInheritTree(self, 'events', false, function(handler, eventName) {
      self.on(eventName, handler, self);
    });
  }
};

_.extend(Thorax.View, {
  on: function(eventName, callback) {
    createInheritVars(this);

    if (objectEvents(this, eventName, callback)) {
      return this;
    }

    //accept on({"rendered": handler})
    if (_.isObject(eventName)) {
      _.each(eventName, function(value, key) {
        this.on(key, value);
      }, this);
    } else {
      eventName = eventNameParams(eventName);

      //accept on({"rendered": [handler, handler]})
      if (_.isArray(callback)) {
        _.each(callback, function(cb) {
          this._events.push([eventName, cb]);
        }, this);
      //accept on("rendered", handler)
      } else {
        this._events.push([eventName, callback]);
      }
    }
    return this;
  }
});

_.extend(Thorax.View.prototype, {
  on: function(eventName, callback, context) {
    var self = this;

    if (objectEvents(self, eventName, callback, context)) {
      return self;
    }

    if (_.isObject(eventName) && !eventName.type && arguments.length < 3) {
      //accept on({"rendered": callback})
      _.each(eventName, function(value, key) {
        self.on(key, value, callback || self);    // callback is context in this form of the call
      });
    } else {
      //accept on("rendered", callback, context)
      //accept on("click a", callback, context)
      function handleEvent(callback) {
        var params = eventParamsForInstance(eventName, self, callback, context || self);

        if (params.event.type === 'DOM') {
          // Avoid overhead of handling DOM events on the server
          if ($serverSide) {
            return;
          }

          //will call _addEvent during delegateEvents()
          if (!self._eventsToDelegate) {
            self._eventsToDelegate = [];
          }
          self._eventsToDelegate.push(params);
        }

        if (params.event.type !== 'DOM' || self._eventsDelegated) {
          self._addEvent(params);
        }
      }
      if (_.isArray(callback)) {
        _.each(callback, handleEvent);
      } else {
        handleEvent(callback);
      }
    }
    return self;
  },

  delegateEvents: function(events) {
    this.undelegateEvents();
    if (events) {
      if (_.isFunction(events)) {
        events = events.call(this);
      }
      this._eventsToDelegate = [];
      this.on(events);
    }
    _.each(this._eventsToDelegate, this._addEvent, this);
    this._eventsDelegated = true;
  },
  //params may contain:
  //- name
  //- originalName
  //- selector
  //- type "view" || "DOM"
  //- handler
  _addEvent: function(params) {
    // If this is recursvie due to listenTo delegate below then pass through to super class
    if (params.handler._thoraxBind) {
      return _on.call(this, params.event.name, params.handler, params.context || this);
    }

    // Shortcircuit DOM events on the server
    if ($serverSide && params.event.type !== 'view') {
      return;
    }

    var boundHandler = bindEventHandler(this, params.event.type + '-event:', params);

    if (params.event.type === 'view') {
      // If we have our context set to an outside view then listen rather than directly bind so
      // we can cleanup properly.
      if (params.context && params.context !== this && params.context instanceof Thorax.View) {
        listenTo(params.context, this, params.event.name, boundHandler, params.context);
      } else {
        _on.call(this, params.event.name, boundHandler, params.context || this);
      }
    } else {
      // DOM Events
      if (!params.event.nested) {
        boundHandler = containHandlerToCurentView(boundHandler, this);
      }

      var name = params.event.name + '.delegateEvents' + this.cid;
      if (params.event.selector) {
        this.$el.on(name, params.event.selector, boundHandler);
      } else {
        this.$el.on(name, boundHandler);
      }
    }
  }
});

Thorax.View.prototype.bind = Thorax.View.prototype.on;

// When view is ready trigger ready event on all
// children that are present, then register an
// event that will trigger ready on new children
// when they are added
Thorax.View.on('ready', function(options) {
  if (!this._isReady) {
    this._isReady = true;
    function triggerReadyOnChild(child) {
      child._isReady || child.trigger('ready', options);
    }
    _.each(this.children, triggerReadyOnChild);
    this.on('child', triggerReadyOnChild);
  }
});

function containHandlerToCurentView(handler, current) {
  // Passing the current view rather than just a cid to allow for updates to the view's cid
  // caused by the restore process.
  return function(event) {
    var view = $(event.target).view({el: true, helper: false});
    if (view[0] === current.el) {
      event.originalContext = this;
      return handler(event);
    }
  };
}

function bindEventHandler(view, eventName, params) {
  eventName += params.event.originalName;

  var callback = params.handler,
      method = typeof callback == 'string' ? view[callback] : callback;
  if (!method) {
    throw new Error('Event "' + callback + '" does not exist ' + (view.name || view.cid) + ':' + eventName);
  }

  var context = params.context || view,
      ret = Thorax.bindSection(
        'thorax-event',
        {view: context.name || context.cid, eventName: eventName},
        function() { return method.apply(context, arguments); });

  // Backbone will delegate to _callback in off calls so we should still be able to support
  // calling off on specific handlers.
  ret._callback = method;
  ret._thoraxBind = true;
  return ret;
}

function eventNameParams(name) {
  if (name.type) {
    return name;
  }

  var params = eventParamsCache[name];
  if (params) {
    return params;
  }

  params = eventNameParams[name] = {
    type: 'view',
    name: name,
    originalName: name,

    nested: false,
    selector: undefined
  };

  var match = name.match(eventSplitter);
  if (match && domEvents[match[2]]) {
    params.type = 'DOM';
    params.name = match[2];
    params.nested = !!match[1];
    params.selector = match[3];
  }
  return params;
}
function eventParamsForInstance(eventName, view, handler, context) {
  return {
    event: eventNameParams(eventName),
    context: context,
    handler: typeof handler == 'string' ? view[handler] : handler
  };
}

;;
/*global
    ServerMarshal,
    $serverSide, createError, filterAncestors,
    normalizeHTMLAttributeOptions, viewHelperAttributeName
*/
var viewPlaceholderAttributeName = 'data-view-tmp',
    viewTemplateOverrides = {};

// Will be shared by HelperView and CollectionHelperView
var helperViewPrototype = {
  _ensureElement: function() {
    Thorax.View.prototype._ensureElement.call(this);
    this.$el.attr(viewHelperAttributeName, this._helperName);
  },
  _getContext: function() {
    return this.parent._getContext();
  }
};

Thorax.HelperView = Thorax.View.extend(helperViewPrototype);

// Ensure nested inline helpers will always have this.parent
// set to the view containing the template
function getParent(parent) {
  // The `view` helper is a special case as it embeds
  // a view instead of creating a new one
  while (parent._helperName && parent._helperName !== 'view') {
    parent = parent.parent;
  }
  return parent;
}

function expandHash(context, hash) {
  if (hash['expand-tokens']) {
    delete hash['expand-tokens'];
    _.each(hash, function(value, key) {
      hash[key] = Thorax.Util.expandToken(value, context);
    });
    return true;
  }
}

Handlebars.registerViewHelper = function(name, ViewClass, callback) {
  if (arguments.length === 2) {
    if (ViewClass.factory) {
      callback = ViewClass.callback;
    } else {
      callback = ViewClass;
      ViewClass = Thorax.HelperView;
    }
  }

  var viewOptionWhiteList = ViewClass.attributeWhiteList;

  Handlebars.registerHelper(name, function() {
    var args = [],
        options = arguments[arguments.length-1],
        declaringView = options.data.view;
    for (var i = 0, len = arguments.length-1; i < len; i++) {
      args.push(arguments[i]);
    }
 
    // Evaluate any nested parameters that we may have to content with
    var expandTokens = expandHash(this, options.hash);

    var viewOptions = createViewOptions(name, args, options, declaringView);
    setHelperTemplate(viewOptions, options, ViewClass);

    normalizeHTMLAttributeOptions(options.hash);
    var htmlAttributes = _.clone(options.hash);

    // Remap any view options per the whitelist and remove the source form the HTML
    _.each(viewOptionWhiteList, function(dest, source) {
      delete htmlAttributes[source];
      if (!_.isUndefined(options.hash[source])) {
        viewOptions[dest] = options.hash[source];
      }
    });
    if(htmlAttributes.tagName) {
      viewOptions.tagName = htmlAttributes.tagName;
    }

    viewOptions.attributes = function() {
      var attrs = (ViewClass.prototype && ViewClass.prototype.attributes) || {};
      if (_.isFunction(attrs)) {
        attrs = attrs.call(this);
      }
      _.extend(attrs, _.omit(htmlAttributes, ['tagName']));
      // backbone wants "class"
      if (attrs.className) {
        attrs['class'] = attrs.className;
        delete attrs.className;
      }
      return attrs;
    };


    // Check to see if we have an existing instance that we can reuse
    var instance = _.find(declaringView._previousHelpers, function(child) {
      return child._cull && compareHelperOptions(viewOptions, child);
    });

    // Create the instance if we don't already have one
    if (!instance) {
      instance = getHelperInstance(args, viewOptions, ViewClass);
      if (!instance) {
        return '';
      }

      instance.$el.attr('data-view-helper-restore', name);

      if ($serverSide && instance.$el.attr('data-view-restore') !== 'false') {
        saveServerState(instance, args, options);
      }

      helperInit(args, instance, callback, viewOptions);
    } else {
      if (!instance.el) {
        throw new Error('insert-destroyed');
      }

      declaringView.children[instance.cid] = instance;
    }

    // Remove any possible entry in previous helpers in case this is a cached value returned from
    // slightly different data that does not qualify for the previous helpers direct reuse.
    // (i.e. when using an array that is modified between renders)
    instance._cull = false;

    // Register the append helper if not already done
    if (!declaringView._pendingAppend) {
      declaringView._pendingAppend = true;
      declaringView.once('append', helperAppend);
    }

    htmlAttributes[viewPlaceholderAttributeName] = instance.cid;
    if (ViewClass.modifyHTMLAttributes) {
      ViewClass.modifyHTMLAttributes(htmlAttributes, instance);
    }
    return new Handlebars.SafeString(Thorax.Util.tag(htmlAttributes, '', expandTokens ? this : null));
  });

  var helper = Handlebars.helpers[name];

  function saveServerState(instance, args, options) {
    try {
      ServerMarshal.store(instance.$el, 'args', args, options.ids, options);
      ServerMarshal.store(instance.$el, 'attrs', options.hash, options.hashIds, options);
      if (options.fn && options.fn !== Handlebars.VM.noop) {
        if (options.fn.depth) {
          // Depthed block helpers are not supoprted.
          throw new Error();
        }
        ServerMarshal.store(instance.$el, 'fn', options.fn.program);
      }
      if (options.inverse && options.inverse !== Handlebars.VM.noop) {
        if (options.inverse.depth) {
          // Depthed block helpers are not supoprted.
          throw new Error();
        }
        ServerMarshal.store(instance.$el, 'inverse', options.inverse.program);
      }
    } catch (err) {
      instance.$el.attr('data-view-restore', 'false');

      instance.trigger('restore:fail', {
        type: 'serialize',
        view: instance,
        err: err
      });
    }
  }
  helper.restore = function(declaringView, el, forceRerender) {
    var context = declaringView.context(),
        args = ServerMarshal.load(el, 'args', declaringView, context) || [],
        attrs = ServerMarshal.load(el, 'attrs', declaringView, context) || {};

    var options = {
      hash: attrs,
      fn: ServerMarshal.load(el, 'fn'),
      inverse: ServerMarshal.load(el, 'inverse')
    };

    declaringView.template._setup({helpers: this.helpers});

    if (options.fn) {
      options.fn = declaringView.template._child(options.fn);
    }
    if (options.inverse) {
      options.inverse = declaringView.template._child(options.inverse);
    }

    var viewOptions = createViewOptions(name, args, options, declaringView);
    setHelperTemplate(viewOptions, options, ViewClass);

    if (viewOptionWhiteList) {
      _.each(viewOptionWhiteList, function(dest, source) {
        if (!_.isUndefined(attrs[source])) {
          viewOptions[dest] = attrs[source];
        }
      });
    }

    var instance = getHelperInstance(args, viewOptions, ViewClass);
    if (!instance) {
      // We can't do anything more, leave the element in
      return;
    }

    instance._assignCid(el.getAttribute('data-view-cid'));
    helperInit(args, instance, callback, viewOptions);

    instance.restore(el, forceRerender);

    return instance;
  };

  return helper;
};

Thorax.View.on('restore', function(forceRerender) {
  var parent = this,
      context;

  parent.$('[data-view-helper-restore][data-view-restore=true]').each(filterAncestors(parent, function() {
    var helper = Handlebars.helpers[this.getAttribute('data-view-helper-restore')],
        child = helper.restore(parent, this, forceRerender);
    if (child) {
      parent._addChild(child);
    }
  }));
});

function createViewOptions(name, args, options, declaringView) {
  return {
    inverse: options.inverse,
    options: options.hash,
    declaringView: declaringView,
    parent: getParent(declaringView),
    _helperName: name,
    _helperOptions: {
      options: cloneHelperOptions(options),
      args: _.clone(args)
    }
  };
}

function setHelperTemplate(viewOptions, options, ViewClass) {
  if (options.fn) {
    // Only assign if present, allow helper view class to
    // declare template
    viewOptions.template = options.fn;
  } else if (ViewClass && ViewClass.prototype && !ViewClass.prototype.template) {
    // ViewClass may also be an instance or object with factory method
    // so need to do this check
    viewOptions.template = Handlebars.VM.noop;
  }
}

function getHelperInstance(args, viewOptions, ViewClass) {
  var instance;

  if (ViewClass.factory) {
    instance = ViewClass.factory(args, viewOptions);
    if (!instance) {
      return;
    }

    instance._helperName = viewOptions._helperName;
    instance._helperOptions = viewOptions._helperOptions;
  } else {
    instance = new ViewClass(viewOptions);
  }

  if (!instance.el) {
    // ViewClass.factory may return existing objects which may have been destroyed
    throw createError('insert-destroyed-factory');
  }
  return instance;
}
function helperInit(args, instance, callback, viewOptions) {
  var declaringView = viewOptions.declaringView,
      name = viewOptions._helperName;

  args.push(instance);
  declaringView._addChild(instance);
  declaringView.trigger.apply(declaringView, ['helper', name].concat(args));

  callback && callback.apply(this, args);
}

function helperAppend(scope, callback, deferrable) {
  this._pendingAppend = undefined;

  var self = this;
  (scope || this.$el).find('[' + viewPlaceholderAttributeName + ']').forEach(function(el) {
    var $el = $(el),
        placeholderId = $el.attr(viewPlaceholderAttributeName),
        view = self.children[placeholderId];

    if (view) {
      deferrable.chain(function(next) {
        //see if the view helper declared an override for the view
        //if not, ensure the view has been rendered at least once
        if (viewTemplateOverrides[placeholderId]) {
          view.render(viewTemplateOverrides[placeholderId], next);
          delete viewTemplateOverrides[placeholderId];
        } else {
          view.ensureRendered(next);
        }
        $el.replaceWith(view.el);
      });
    }
    if (view && callback) {
      deferrable.exec(function() {
        callback(view.$el);
      });
    }
  });
}

/**
 * Clones the helper options, dropping items that are known to change
 * between rendering cycles as appropriate.
 */
function cloneHelperOptions(options) {
  var ret = _.pick(options, 'fn', 'inverse', 'hash', 'data');
  ret.data = _.omit(options.data, 'cid', 'view', 'yield', 'root', '_parent');

  // This is necessary to prevent failures when mixing restored and rendered data
  // as it forces the keys object to be complete.
  ret.fn = ret.fn || undefined;
  ret.inverse = ret.inverse || undefined;

  return ret;
}

/**
 * Checks for basic equality between two sets of parameters for a helper view.
 *
 * Checked fields include:
 *  - _helperName
 *  - All args
 *  - Hash
 *  - Data
 *  - Function and Invert (id based if possible)
 *
 * This method allows us to determine if the inputs to a given view are the same. If they
 * are then we make the assumption that the rendering will be the same (or the child view will
 * otherwise rerendering it by monitoring it's parameters as necessary) and reuse the view on
 * rerender of the parent view.
 */
function compareHelperOptions(a, b) {
  function compareValues(a, b) {
    return _.every(a, function(value, key) {
      return b[key] === value;
    });
  }

  if (a._helperName !== b._helperName) {
    return false;
  }

  a = a._helperOptions;
  b = b._helperOptions;

  // Implements a first level depth comparison
  return a.args.length === b.args.length
      && compareValues(a.args, b.args)
      && _.isEqual(_.keys(a.options).sort(), _.keys(b.options).sort())
      && _.every(a.options, function(value, key) {
          if (key === 'data' || key === 'hash') {
            return compareValues(a.options[key], b.options[key]);
          } else if (key === 'fn' || key === 'inverse') {
            if (b.options[key] === value) {
              return true;
            }

            var other = b.options[key] || {};
            return value && _.has(value, 'program') && !value.depth && other.program === value.program;
          }
          return b.options[key] === value;
        });
}

;;
/*global $serverSide, getValue, inheritVars, listenTo, walkInheritTree */

function dataObject(type, spec) {
  spec = inheritVars[type] = _.defaults({
    name: '_' + type + 'Events',
    event: true
  }, spec);

  // Add a callback in the view constructor
  spec.ctor = function(view) {
    if (view[type]) {
      // Need to null this.model/collection so setModel/Collection will
      // not treat it as the old model/collection and immediately return
      var object = view[type];
      view[type] = null;
      view[spec.set](object);
    }
  };

  function setObject(dataObject, options) {
    var old = this[type],
        $el = getValue(this, spec.$el);

    if (dataObject === old) {
      return this;
    }
    if (old) {
      this.unbindDataObject(old);
    }

    if (dataObject) {
      this[type] = dataObject;

      if (spec.loading) {
        spec.loading(this);
      }

      this.bindDataObject(type, dataObject, _.extend({}, this.options, options));
      if ($el) {
        var attr = {};
        if ($serverSide && spec.idAttrName) {
          attr[spec.idAttrName] = dataObject.id;
        }
        attr[spec.cidAttrName] = dataObject.cid;
        $el.attr(attr);
      }
      dataObject.trigger('set', dataObject, old);
    } else {
      this[type] = false;
      if (spec.change) {
        spec.change(this, false);
      }
      $el && $el.removeAttr(spec.cidAttrName);
    }
    this.trigger('change:data-object', type, dataObject, old);
    return this;
  }

  Thorax.View.prototype[spec.set] = setObject;
}

_.extend(Thorax.View.prototype, {
  getObjectOptions: function(dataObject) {
    return dataObject && this._objectOptionsByCid[dataObject.cid];
  },

  bindDataObject: function(type, dataObject, options) {
    if (this._boundDataObjectsByCid[dataObject.cid]) {
      return;
    }
    this._boundDataObjectsByCid[dataObject.cid] = dataObject;

    var options = this._modifyDataObjectOptions(dataObject, _.extend({}, inheritVars[type].defaultOptions, options));
    this._objectOptionsByCid[dataObject.cid] = options;

    bindEvents(this, type, dataObject, this.constructor);
    bindEvents(this, type, dataObject, this);

    var spec = inheritVars[type];
    spec.bindCallback && spec.bindCallback(this, dataObject, options);

    if (dataObject.shouldFetch && dataObject.shouldFetch(options)) {
      loadObject(dataObject, options);
    } else if (inheritVars[type].change) {
      // want to trigger built in rendering without triggering event on model
      inheritVars[type].change(this, dataObject, options);
    }
  },

  unbindDataObject: function (dataObject) {
    this.stopListening(dataObject);
    delete this._boundDataObjectsByCid[dataObject.cid];
    delete this._objectOptionsByCid[dataObject.cid];
  },

  _modifyDataObjectOptions: function(dataObject, options) {
    return options;
  }
});

function bindEvents(context, type, target, source) {
  walkInheritTree(source, '_' + type + 'Events', true, function(event) {
    listenTo(context, target, event[0], event[1], event[2] || context);
  });
}

function loadObject(dataObject, options) {
  if (dataObject.load) {
    dataObject.load(function() {
      options && options.success && options.success(dataObject);
    }, options);
  } else {
    dataObject.fetch(options);
  }
}

function getEventCallback(callback, context) {
  if (_.isFunction(callback)) {
    return callback;
  } else {
    return context[callback];
  }
}

;;
/*global createRegistryWrapper, dataObject, getValue, inheritVars */
var modelCidAttributeName = 'data-model-cid',
    modelIdAttributeName = 'data-model-id';

Thorax.Model = Backbone.Model.extend({
  isEmpty: function() {
    return !this.isPopulated();
  },
  isPopulated: function() {
    /*jshint -W089 */

    // We are populated if we have attributes set
    var attributes = _.clone(this.attributes),
        defaults = getValue(this, 'defaults') || {};
    for (var default_key in defaults) {
      if (attributes[default_key] != defaults[default_key]) {
        return true;
      }
      delete attributes[default_key];
    }
    var keys = _.keys(attributes);
    return keys.length > 1 || (keys.length === 1 && keys[0] !== this.idAttribute);
  },
  shouldFetch: function(options) {
    // url() will throw if model has no `urlRoot` and no `collection`
    // or has `collection` and `collection` has no `url`
    var url;
    try {
      url = getValue(this, 'url');
    } catch(e) {
      url = false;
    }
    return options.fetch && !!url && !this.isPopulated();
  }
});

Thorax.Models = {};
createRegistryWrapper(Thorax.Model, Thorax.Models);

dataObject('model', {
  set: 'setModel',
  defaultOptions: {
    render: undefined,    // Default to deferred rendering
    fetch: true,
    success: false,
    invalid: true
  },
  change: onModelChange,
  $el: '$el',
  idAttrName: modelIdAttributeName,
  cidAttrName: modelCidAttributeName
});

function onModelChange(view, model, options) {
  if (options && options.serializing) {
    return;
  }

  var modelOptions = view.getObjectOptions(model) || {};
  // !modelOptions will be true when setModel(false) is called
  view.conditionalRender(modelOptions.render);
}

Thorax.View.on({
  model: {
    invalid: function(model, errors) {
      if (this.getObjectOptions(model).invalid) {
        this.trigger('invalid', errors, model);
      }
    },
    error: function(model, resp /*, options */) {
      this.trigger('error', resp, model);
    },
    change: function(model, options) {
      // Indirect refernece to allow for overrides
      inheritVars.model.change(this, model, options);
    }
  }
});

$.fn.model = function(view) {
  var $this = $(this),
      modelElement = $this.closest('[' + modelCidAttributeName + ']'),
      modelCid = modelElement && modelElement.attr(modelCidAttributeName);
  if (modelCid) {
    var view = view || $this.view();
    if (view && view.model && view.model.cid === modelCid) {
      return view.model || false;
    }
    var collection = $this.collection(view);
    if (collection) {
      return collection.get(modelCid);
    }
  }
  return false;
};

;;
/*global
    $serverSide,
    assignView, assignTemplate, createRegistryWrapper, dataObject, filterAncestors, getValue,
    modelCidAttributeName, modelIdAttributeName, viewCidAttributeName,
    Deferrable
*/
var _fetch = Backbone.Collection.prototype.fetch,
    _set = Backbone.Collection.prototype.set,
    _replaceHTML = Thorax.View.prototype._replaceHTML,
    collectionCidAttributeName = 'data-collection-cid',
    collectionEmptyAttributeName = 'data-collection-empty',
    collectionElementAttributeName = 'data-collection-element',
    ELEMENT_NODE_TYPE = 1;

Thorax.Collection = Backbone.Collection.extend({
  model: Thorax.Model || Backbone.Model,
  initialize: function(models, options) {
    this.cid = _.uniqueId('collection');
    return Backbone.Collection.prototype.initialize.call(this, models, options);
  },
  isEmpty: function() {
    if (this.length > 0) {
      return false;
    } else {
      return this.length === 0 && this.isPopulated();
    }
  },
  isPopulated: function() {
    return this._fetched || this.length > 0 || (!this.length && !getValue(this, 'url'));
  },
  shouldFetch: function(options) {
    return options.fetch && !!getValue(this, 'url') && !this.isPopulated();
  },
  fetch: function(options) {
    options = options || {};
    var success = options.success;
    options.success = function(collection, response, options) {
      collection._fetched = true;
      success && success(collection, response, options);
    };
    return _fetch.call(this, options);
  },
  set: function(models, options) {
    this._fetched = !!models;
    return _set.call(this, models, options);
  }
});

_.extend(Thorax.View.prototype, {
  getCollectionViews: function(collection) {
    return _.filter(this.children, function(child) {
      if (!(child instanceof Thorax.CollectionView)) {
        return false;
      }

      return !collection || (child.collection === collection);
    });
  },
  updateFilter: function(collection) {
    _.invoke(this.getCollectionViews(collection), 'updateFilter');
  }
});

Thorax.Collections = {};
createRegistryWrapper(Thorax.Collection, Thorax.Collections);

dataObject('collection', {
  set: 'setCollection',
  bindCallback: onSetCollection,
  defaultOptions: {
    render: undefined,    // Default to deferred rendering
    fetch: true,
    success: false,
    invalid: true,
    change: true          // Wether or not to re-render on model:change
  },
  change: onCollectionReset,
  $el: 'getCollectionElement',
  cidAttrName: collectionCidAttributeName
});

Thorax.CollectionView = Thorax.View.extend({
  _defaultTemplate: Handlebars.VM.noop,
  _collectionSelector: '[' + collectionElementAttributeName + ']',

  // preserve collection element if it was not created with {{collection}} helper
  _replaceHTML: function(html) {
    if (this.collection && this.getObjectOptions(this.collection) && this._renderCount) {
      var element;
      var oldCollectionElement = this._collectionElement;
      element = _replaceHTML.call(this, html);

      this._lookupCollectionElement();

      if (!oldCollectionElement.attr('data-view-cid')) {
        this._collectionElement.replaceWith(oldCollectionElement);
      }
    } else {
      var ret = _replaceHTML.call(this, html);
      this._lookupCollectionElement();

      return ret;
    }
  },

  render: function(output, callback) {
    if (!this.shouldRender()) {
      var self = this;
      this.once('append', function(scope, _callback, deferrable) {
        deferrable.chain(function(next) {
          self.renderCollection(next);
        });
      });
    }

    return Thorax.View.prototype.render.call(this, output, callback);
  },

  restore: function(el, forceRerender) {
    this._forceRerender = forceRerender;
    Thorax.View.prototype.restore.call(this, el);
  },
  restoreCollection: function() {
    // This is called as an event so we don't force render our content when there are nested
    // child views.
    var self = this,
        children = this.$el.children(),
        toRemove = [],
        restored = 0;

    this._lookupCollectionElement();

    // Find any items annotated with server info and restore. Else rerender
    this.$('[' + modelIdAttributeName + ']').each(filterAncestors(self, function() {
      var id = this.getAttribute(modelIdAttributeName),
          model = self.collection.get(id);

      if (!model) {
        toRemove.push(this);
      } else {
        self.restoreItem(model, children.index(this), this, self._forceRerender);
        restored++;
      }
    }));

    var removeEmpty;
    this.$('[data-view-empty]').each(filterAncestors(self, function() {
      if (!self.collection.length) {
        self.restoreEmpty(this, self._forceRerender);
      } else {
        removeEmpty = true;
      }
    }));

    var needsRender = (restored !== this.collection.length) || toRemove.length || removeEmpty;
    if (needsRender && this.collection.isPopulated()) {
      // Kill off any now invalid nodes
      _.each(toRemove, function(el) {
        el.parentNode.removeChild(el);

        self.trigger('restore:fail', {
          type: 'collection-remove',
          element: el
        });
      });

      if (removeEmpty || !this.collection.length) {
        // Complete mismatch on expectations for empty state, etc. Rerender the entierty of the
        // content to be safe.
        this.renderCollection();

        self.trigger('restore:fail', {
          type: removeEmpty ? 'collection-empty-found' : 'collection-empty-missing'
        });
      } else {
        // Render anything that we might have locally but was missed
        var $el = this._collectionElement;
        this.collection.each(function(model) {
          if (!$el.find('[' + modelCidAttributeName + '="' + model.cid + '"]').length) {
            self.appendItem(model);

            self.trigger('restore:fail', {
              type: 'collection-missing',
              model: model
            });
          }
        });
      }
    } else if (needsRender) {
      this._pendingRestore = true;
      return;
    }

    this.trigger('restore:collection', this, this.el);
  },

  //appendItem(model [,index])
  //appendItem(html_string, index)
  //appendItem(view, index)
  appendItem: function(model, index, options, append, callback) {
    //empty item
    if (!model) {
      return;
    }
    var itemView,
        $el = this._collectionElement,
        collection = this.collection,

        filter = !options || options.filter == null || options.filter;

    //if index argument is a view
    if (index && index.el) {
      index = $el.children().indexOf(index.el) + 1;
    }

    //if argument is a view, or html string
    if (model.el || _.isString(model)) {
      itemView = model;
      model = false;
    } else {
      index = index != null ? index : (collection.indexOf(model) || 0);

      // Using call here to avoid v8 prototype inline optimization bug that helper views
      // expose under Android 4.3 (at minimum)
      // https://twitter.com/kpdecker/status/422149634929082370
      itemView = this.renderItem.call(this, model, index);
    }

    if (itemView) {
      if (itemView.cid) {
        this._addChild(itemView);
        itemView.ensureRendered();
      }

      //if the renderer's output wasn't contained in a tag, wrap it in a div
      //plain text, or a mixture of top level text nodes and element nodes
      //will get wrapped
      if (_.isString(itemView) && !/^\s*</m.test(itemView)) {
        itemView = '<div>' + itemView + '</div>';
      }
      var itemElement = itemView.$el || $($.trim(itemView)).filter(function() {
        // Only output nodes. DOM || Fruit Loops
        return this.nodeType === ELEMENT_NODE_TYPE || this.type === 'tag';
      });

      if (model) {
        itemElement.attr({
          'data-model-id': model.id,
          'data-model-cid': model.cid
        });
      }

      if (append) {
        $el.append(itemElement);
      } else {
        var previousModel = index > 0 ? collection.at(index - 1) : false;
        if (!previousModel) {
          $el.prepend(itemElement);
        } else {
          //use last() as appendItem can accept multiple nodes from a template
          var last = $el.children('[' + modelCidAttributeName + '="' + previousModel.cid + '"]').last();
          last.after(itemElement);
        }
      }

      this.triggerDeferrable('append', null, function($el) {
        $el.attr({
          'data-model-cid': model.cid,
          'data-model-id': model.id,
        });
      },
      callback);

      if (!options || !options.silent) {
        this.trigger('rendered:item', this, collection, model, itemElement, index);
      }
      if (filter) {
        applyItemVisiblityFilter(this, model);
      }
    }
    return itemView;
  },

  // updateItem only useful if there is no item view, otherwise
  // itemView.render() provides the same functionality
  updateItem: function(model) {
    var $el = this._collectionElement,
        viewEl = $el.find('[' + modelCidAttributeName + '="' + model.cid + '"]');

    // NOP For views
    if (viewEl.attr(viewCidAttributeName)) {
      return;
    }

    this.removeItem(viewEl);
    this.appendItem(model);
  },

  removeItem: function(model) {
    var self = this,
        $viewEl = model;

    if (model.cid) {
      var $el = this._collectionElement;
      $viewEl = $el.find('[' + modelCidAttributeName + '="' + model.cid + '"]');
    }
    if (!$viewEl.length) {
      return false;
    }

    function cleanCid($viewEl) {
      var cid = $viewEl.attr(viewCidAttributeName),
          child = self.children[cid];
      if (child) {
        self._removeChild(child);
      }
    }

    $viewEl.find('[' + viewCidAttributeName + ']').each(function(i, el) {
      cleanCid($(el));
    });
    cleanCid($viewEl);

    $viewEl.detach();

    return true;
  },

  renderCollection: function(callback) {
    var deferrable = new Deferrable(callback),
        self = this;

    if (self.collection) {
      if (self.collection.isEmpty()) {
        deferrable.exec(function() {
          handleChangeFromNotEmptyToEmpty(self);
        });
      } else if (self._pendingRestore) {
        // If we had to delay the initial restore due to the local data set being loaded, then
        // we want to resume that operation where it left off.
        self._pendingRestore = false;
        self.restoreCollection(self._forceRerender);
      } else {
        deferrable.exec(function() {
          handleChangeFromEmptyToNotEmpty(self);
        });

        _.each(self.collection.models, function(item, i) {
          deferrable.chain(function(next) {
            self.appendItem(item, i, undefined, true, next);
          });
        });
      }
      deferrable.exec(function() {
        self.trigger('rendered:collection', self, self.collection);
      });
    } else {
      deferrable.exec(function() {
        handleChangeFromNotEmptyToEmpty(self);
      });
    }

    deferrable.run();
  },
  emptyClass: 'empty',
  renderEmpty: function() {
    if (!this.emptyView) {
      assignView(this, 'emptyView', {
        extension: '-empty'
      });
    }
    if (!this.emptyTemplate && !this.emptyView) {
      assignTemplate(this, 'emptyTemplate', {
        extension: '-empty',
        required: false
      });
    }
    if (this.emptyView) {
      var viewOptions = {};
      if (this.emptyTemplate) {
        viewOptions.template = this.emptyTemplate;
      }
      return Thorax.Util.getViewInstance(this.emptyView, viewOptions);
    } else {
      return this.emptyTemplate && this.renderTemplate(this.emptyTemplate);
    }
  },
  restoreEmpty: function(el, forceRerender) {
    var child = this.renderEmpty();

    child.restore(el, forceRerender);
    this._addChild(child);

    this.trigger('restore:empty', this, el);

    return child;
  },

  renderItem: function(model, i) {
    if (!this.itemView) {
      assignView(this, 'itemView', {
        extension: '-item',
        required: false
      });
    }
    if (!this.itemTemplate && !this.itemView) {
      assignTemplate(this, 'itemTemplate', {
        extension: '-item',
        // only require an itemTemplate if an itemView
        // is not present
        required: !this.itemView
      });
    }
    if (this.itemView) {
      var viewOptions = {
        model: model
      };
      if (this.itemTemplate) {
        viewOptions.template = this.itemTemplate;
      }
      return Thorax.Util.getViewInstance(this.itemView, viewOptions);
    } else {
      // Using call here to avoid v8 prototype inline optimization bug that helper views
      // expose under Android 4.3 (at minimum)
      // https://twitter.com/kpdecker/status/422149634929082370
      return this.renderTemplate(this.itemTemplate, this.itemContext.call(this, model, i));
    }
  },
  restoreItem: function(model, i, el, forceRerender) {
    // Associate the element with the proper model.
    el.setAttribute(modelCidAttributeName, model.cid);

    // If we are dealing with something other than a template then reinstantiate the view.
    if (this.itemView || this.renderItem !== Thorax.CollectionView.prototype.renderItem) {
      var child = this.renderItem(model, i);

      // If we are passed a string assume that the upstream implementation has a consistent
      // rendering.
      if (!_.isString(child)) {
        child.restore(el, forceRerender);
        this._addChild(child);
      }
    }

    this.trigger('restore:item', this, el);
  },
  itemContext: function(model /*, i */) {
    return model.attributes;
  },
  appendEmpty: function() {
    var $el = this._collectionElement;
    $el.empty();

    // Using call here to avoid v8 prototype inline optimization bug that helper views
    // expose under Android 4.3 (at minimum)
    // https://twitter.com/kpdecker/status/422149634929082370
    var emptyContent = this.renderEmpty.call(this);
    if (emptyContent && emptyContent.$el) {
      emptyContent.$el.attr('data-view-empty', 'true');
    }
    emptyContent && this.appendItem(emptyContent, 0, {
      silent: true,
      filter: false
    });
    this.trigger('rendered:empty', this, this.collection);
  },
  getCollectionElement: function() {
    return this._collectionElement;
  },
  _lookupCollectionElement: function() {
    var $collectionElement = this.$(this._collectionSelector).filter(filterAncestors(this, function() { return true; }));
    this._collectionElement = $collectionElement.length ? $collectionElement : this.$el;
  },

  updateFilter: function() {
    var view = this;
    if (view.itemFilter) {
      _.each(view.collection.models, function(model) {
        applyItemVisiblityFilter(view, model);
      });
    }
  }
});

Thorax.CollectionView.on({
  restore: 'restoreCollection',

  collection: {
    'reset': function(collection) {
      onCollectionReset(this, collection);
    },
    'sort': function(collection) {
      onCollectionReset(this, collection);
    },
    change: function(model) {
      var options = this.getObjectOptions(this.collection);
      if (options && options.change) {
        this.updateItem(model);
      }
      applyItemVisiblityFilter(this, model);
    },
    add: function(model) {
      var $el = this._collectionElement;
      if ($el.length) {
        if (this.collection.length === 1) {
          handleChangeFromEmptyToNotEmpty(this);
        }

        var index = this.collection.indexOf(model);
        this.appendItem(model, index);
      }
    },
    remove: function(model) {
      var $el = this._collectionElement;
      this.removeItem(model);

      if (this.collection.length === 0 && $el.length) {
        handleChangeFromNotEmptyToEmpty(this);
      }
    }
  }
});

Thorax.View.on({
  collection: {
    invalid: function(collection, message) {
      if (this.getObjectOptions(collection).invalid) {
        this.trigger('invalid', message, collection);
      }
    },
    error: function(collection, resp /*, options */) {
      this.trigger('error', resp, collection);
    }
  }
});

function onCollectionReset(view, collection) {
  // Undefined to force conditional render
  var options = view.getObjectOptions(collection) || undefined;
  if (view.shouldRender(options && options.render)) {
    view.renderCollection && view.renderCollection();
  }
}

// Even if the view is not a CollectionView
// ensureRendered() to provide similar behavior
// to a model
function onSetCollection(view, collection) {
  // Undefined to force conditional render
  var options = view.getObjectOptions(collection) || undefined;
  if (view.shouldRender(options && options.render)) {
    // Ensure that something is there if we are going to render the collection.
    view.ensureRendered();
  }
}

function applyItemVisiblityFilter(view, model) {
  var $el = view._collectionElement;
  view.itemFilter && $el.find('[' + modelCidAttributeName + '="' + model.cid + '"]')[itemShouldBeVisible(view, model) ? 'show' : 'hide']();
}

function itemShouldBeVisible(view, model) {
  // Using call here to avoid v8 prototype inline optimization bug that helper views
  // expose under Android 4.3 (at minimum)
  // https://twitter.com/kpdecker/status/422149634929082370
  return view.itemFilter.call(view, model, view.collection.indexOf(model));
}

function handleChangeFromEmptyToNotEmpty(view) {
  var $el = view._collectionElement;
  view.emptyClass && $el.removeClass(view.emptyClass);
  $el.removeAttr(collectionEmptyAttributeName);
  $el.empty();
}

function handleChangeFromNotEmptyToEmpty(view) {
  var $el = view._collectionElement;
  view.emptyClass && $el.addClass(view.emptyClass);
  $el.attr(collectionEmptyAttributeName, true);
  view.appendEmpty();
}

//$(selector).collection() helper
$.fn.collection = function(view) {
  if (view && view.collection) {
    return view.collection;
  }
  var $this = $(this),
      collectionElement = $this.closest('[' + collectionCidAttributeName + ']'),
      collectionCid = collectionElement && collectionElement.attr(collectionCidAttributeName);
  if (collectionCid) {
    view = $this.view();
    if (view) {
      return view.collection;
    }
  }
  return false;
};

;;
/*global
    $serverSide, FruitLoops,
    createErrorMessage, getLayoutViewsTargetElement,
    normalizeHTMLAttributeOptions, setImmediate, viewNameAttributeName
*/
var layoutCidAttributeName = 'data-layout-cid';

Thorax.LayoutView = Thorax.View.extend({
  _defaultTemplate: Handlebars.VM.noop,
  render: function(output) {
    var response = Thorax.View.prototype.render.call(this, output);
    if (this.template === Handlebars.VM.noop) {
      // if there is no template setView will append to this.$el
      ensureLayoutCid(this);
    } else {
      // if a template was specified is must declare a layout-element
      ensureLayoutViewsTargetElement(this);
    }
    return response;
  },
  restore: function(element, forceRerender) {
    // Layout views don't have a traditional forced rerender cycle so we want to manage this
    // ourselves.
    this._forceRerender = forceRerender;
    Thorax.View.prototype.restore.call(this, element);
  },
  setView: function(view, options) {
    options = _.extend({
      scroll: true
    }, options);

    if (_.isString(view)) {
      view = new (Thorax.Util.registryGet(Thorax, 'Views', view, false))();
    }

    if (!$serverSide && !this.hasBeenSet) {
      var existing = this.$('[' + viewNameAttributeName + '="' + view.name + '"]')[0];
      if (existing) {
        view.restore(existing, this._forceRerender);
      } else {
        $(this._layoutViewEl).empty();
      }
    }
    this.ensureRendered();

    var oldView = this._view,
        self = this,
        serverRender = view && $serverSide && (options.serverRender || view.serverRender),
        attemptAsync = options.async !== false ? options.async || serverRender : false;
    if (view === oldView) {
      return false;
    }

    if (attemptAsync && view && !view._renderCount) {
      setImmediate(function() {
        view.ensureRendered(function() {
          self.setView(view, options);
        });
      });
      return;
    }

    this.trigger('change:view:start', view, oldView, options);

    function remove() {
      if (oldView) {
        oldView.$el && oldView.$el.detach();
        triggerLifecycleEvent(oldView, 'deactivated', options);
        self._removeChild(oldView);
      }
    }

    function append() {
      if (!view) {
        self._view = undefined;
      } else if ($serverSide && !serverRender) {
        // Emit only data for non-server rendered views
        // But we do want to put ourselves into the queue for cleanup on future exec
        self._view = view;
        self._addChild(view);

        FruitLoops.emit();
      } else {
        view.ensureRendered();
        options.activating = view;

        triggerLifecycleEvent(self, 'activated', options);
        view.trigger('activated', options);
        self._view = view;
        var targetElement = self._layoutViewEl;
        self._view.appendTo(targetElement);
        self._addChild(view);
      }
    }

    function complete() {
      self.hasBeenSet = true;
      self.trigger('change:view:end', view, oldView, options);
    }

    if (!options.transition) {
      remove();
      append();
      complete();
    } else {
      options.transition(view, oldView, append, remove, complete);
    }

    return view;
  },

  getView: function() {
    return this._view;
  }
});

Thorax.LayoutView.on('after-restore', function() {
  ensureLayoutViewsTargetElement(this);
});

Handlebars.registerHelper('layout-element', function(options) {
  var view = options.data.view;
  // duck type check for LayoutView
  if (!view.getView) {
    throw new Error(createErrorMessage('layout-element-helper'));
  }
  options.hash[layoutCidAttributeName] = view.cid;
  normalizeHTMLAttributeOptions(options.hash);
  return new Handlebars.SafeString(Thorax.Util.tag.call(this, options.hash, '', this));
});

function triggerLifecycleEvent(view, eventName, options) {
  options = options || {};
  options.target = view;
  view.trigger(eventName, options);
  _.each(view.children, function(child) {
    child.trigger(eventName, options);
  });
}

function ensureLayoutCid(view) {
  //set the layoutCidAttributeName on this.$el if there was no template
  view.$el.attr(layoutCidAttributeName, view.cid);
  view._layoutViewEl = view.el;
}

function ensureLayoutViewsTargetElement(view) {
  var el = view.$('[' + layoutCidAttributeName + '="' + view.cid + '"]')[0];
  if (!el && view.$el.attr(layoutCidAttributeName)) {
    el = view.el;
  }
  if (!el) {
    throw new Error('No layout element found in ' + (view.name || view.cid));
  }
  view._layoutViewEl = el;
}

;;
/* global
    $serverSide,
    collectionElementAttributeName, createErrorMessage, getParent,
    helperViewPrototype, normalizeHTMLAttributeOptions,
    viewRestoreAttribute
*/

Thorax.CollectionHelperView = Thorax.CollectionView.extend({
  // Forward render events to the parent
  events: {
    'rendered:collection': forwardRenderEvent('rendered:collection'),
    'rendered:item': function(view, collection, model, itemEl, index) {
      this.parent.trigger('rendered:item', view, collection, model, itemEl, index);
    },
    'rendered:empty': forwardRenderEvent('rendered:empty'),
    'restore:collection': forwardRenderEvent('restore:collection'),
    'restore:item': forwardRenderEvent('restore:item'),
    'restore:empty': forwardRenderEvent('restore:empty')
  },

  // Thorax.CollectionView allows a collectionSelector
  // to be specified, disallow in a collection helper
  // as it will cause problems when neseted
  getCollectionElement: function() {
    return this.$el;
  },

  constructor: function(options) {
    var restorable = true;

    // need to fetch templates if template name was passed
    if (options.options['item-template']) {
      options.itemTemplate = Thorax.Util.getTemplate(options.options['item-template']);
    }
    if (options.options['empty-template']) {
      options.emptyTemplate = Thorax.Util.getTemplate(options.options['empty-template']);
    }

    // Handlebars.VM.noop is passed in the handlebars options object as
    // a default for fn and inverse, if a block was present. Need to
    // check to ensure we don't pick the empty / null block up.
    if (!options.itemTemplate && options.template && options.template !== Handlebars.VM.noop) {
      options.itemTemplate = options.template;
      options.template = Handlebars.VM.noop;

      // We can not restore if the item has a depthed reference, ../foo, so we need to
      // force a rerender on the client-side
      if (options.itemTemplate.depth) {
        restorable = false;
      }
    }
    if (!options.emptyTemplate && options.inverse && options.inverse !== Handlebars.VM.noop) {
      options.emptyTemplate = options.inverse;
      options.inverse = Handlebars.VM.noop;

      if (options.emptyTemplate.depth) {
        restorable = false;
      }
    }

    var shouldBindItemContext = _.isFunction(options.itemContext),
        shouldBindItemFilter = _.isFunction(options.itemFilter);

    var response = Thorax.HelperView.call(this, options);
    
    if (shouldBindItemContext) {
      this.itemContext = _.bind(this.itemContext, this.parent);
    } else if (_.isString(this.itemContext)) {
      this.itemContext = _.bind(this.parent[this.itemContext], this.parent);
    }

    if (shouldBindItemFilter) {
      this.itemFilter = _.bind(this.itemFilter, this.parent);
    } else if (_.isString(this.itemFilter)) {
      this.itemFilter = _.bind(this.parent[this.itemFilter], this.parent);
    }

    if (this.parent.name) {
      if (!this.emptyView && !this.parent.renderEmpty) {
        this.emptyView = Thorax.Util.getViewClass(this.parent.name + '-empty', true);
      }
      if (!this.emptyTemplate && !this.parent.renderEmpty) {
        this.emptyTemplate = Thorax.Util.getTemplate(this.parent.name + '-empty', true);
      }
      if (!this.itemView && !this.parent.renderItem) {
        this.itemView = Thorax.Util.getViewClass(this.parent.name + '-item', true);
      }
      if (!this.itemTemplate && !this.parent.renderItem) {
        // item template must be present if an itemView is not
        this.itemTemplate = Thorax.Util.getTemplate(this.parent.name + '-item', !!this.itemView);
      }
    }

    if ($serverSide && !restorable) {
      this.$el.attr(viewRestoreAttribute, 'false');

      this.trigger('restore:fail', {
        type: 'serialize',
        view: this,
        err: 'collection-depthed-query'
      });
    }

    return response;
  },
  setAsPrimaryCollectionHelper: function() {
    var self = this,
        parent = self.parent;
    _.each(forwardableProperties, function(propertyName) {
      forwardMissingProperty(self, propertyName);
    });

    _.each(['itemFilter', 'itemContext', 'renderItem', 'renderEmpty'], function(propertyName) {
      if (parent[propertyName]) {
        self[propertyName] = function(thing1, thing2) {
          return parent[propertyName](thing1, thing2);
        };
      }
    });
  }
});

_.extend(Thorax.CollectionHelperView.prototype, helperViewPrototype);


Thorax.CollectionHelperView.attributeWhiteList = {
  'item-context': 'itemContext',
  'item-filter': 'itemFilter',
  'item-template': 'itemTemplate',
  'empty-template': 'emptyTemplate',
  'item-view': 'itemView',
  'empty-view': 'emptyView',
  'empty-class': 'emptyClass'
};

function forwardRenderEvent(eventName) {
  return function(thing1, thing2) {
    this.parent.trigger(eventName, thing1, thing2);
  };
}

var forwardableProperties = [
  'itemTemplate',
  'itemView',
  'emptyTemplate',
  'emptyView'
];

function forwardMissingProperty(view, propertyName) {
  var parent = getParent(view);
  if (!view[propertyName]) {
    var prop = parent[propertyName];
    if (prop){
      view[propertyName] = prop;
    }
  }
}

Handlebars.registerViewHelper('collection', Thorax.CollectionHelperView, function(collection, view) {
  if (arguments.length === 1) {
    view = collection;
    collection = view.parent.collection;

    if (collection) {
      view.setAsPrimaryCollectionHelper();
    }
    view.$el.attr(collectionElementAttributeName, 'true');
    // propagate future changes to the parent's collection object
    // to the helper view
    view.listenTo(view.parent, 'change:data-object', function(type, dataObject) {
      if (type === 'collection') {
        view.setAsPrimaryCollectionHelper();
        view.setCollection(dataObject);
      }
    });
  }
  if (collection) {
    view.setCollection(collection);
  }
});

Handlebars.registerHelper('collection-element', function(options) {
  if (!options.data.view.renderCollection) {
    throw new Error(createErrorMessage('collection-element-helper'));
  }
  var hash = options.hash;
  normalizeHTMLAttributeOptions(hash);
  hash.tagName = hash.tagName || 'div';
  hash[collectionElementAttributeName] = true;
  return new Handlebars.SafeString(Thorax.Util.tag.call(this, hash, '', this));
});

;;
Handlebars.registerHelper('empty', function(dataObject, options) {
  if (arguments.length === 1) {
    options = dataObject;
  }
  var view = options.data.view;
  if (arguments.length === 1) {
    dataObject = view.model;
  }
  // listeners for the empty helper rather than listeners
  // that are themselves empty
  if (!view._emptyListeners) {
    view._emptyListeners = {};
  }
  // duck type check for collection
  if (dataObject && !view._emptyListeners[dataObject.cid] && dataObject.models && ('length' in dataObject)) {
    view._emptyListeners[dataObject.cid] = true;
    view.listenTo(dataObject, 'remove', function() {
      if (dataObject.length === 0) {
        view.render();
      }
    });
    view.listenTo(dataObject, 'add', function() {
      if (dataObject.length === 1) {
        view.render();
      }
    });
    view.listenTo(dataObject, 'reset', function() {
      view.render();
    });
  }
  return !dataObject || dataObject.isEmpty() ? options.fn(this) : options.inverse(this);
});

;;
Handlebars.registerHelper('template', function(name, options) {
  /*jshint -W089 */
  var hasHash = false;
  for (var _name in options.hash) {
    // Not doing hasOwnProperty check here as this is going to be a handlebars
    // generated object literal in most cases and under the rare situation that
    // the Object prototype has manipulated, the extend path will continue to do
    // the correct thing.
    hasHash = true;
    break;
  }

  var context = this;
  if (options.fn || hasHash) {
    context = Object.create ? Object.create(this) : _.clone(this);
    _.extend(context, {fn: options.fn}, options.hash);
  }

  var output = options.data.view.renderTemplate(name, context);
  return new Handlebars.SafeString(output);
});

Handlebars.registerHelper('yield', function(options) {
  return options.data.yield();
});

;;
Handlebars.registerHelper('url', function(_url, options) {
  var url = _url || '';

  var fragment = '';
  if (arguments.length > 2) {
    for (var i = 0, len = arguments.length - 1; i < len; i++) {
      fragment += (i ? '/' : '') + encodeURIComponent(arguments[i]);
    }
  } else {
    var hash = (options && options.hash) || options;
    if (hash && hash['expand-tokens']) {
      fragment = Thorax.Util.expandToken(url, this, true);
    } else {
      fragment = url;
    }
  }
  if (Backbone.history._hasPushState) {
    var root = Backbone.history.options.root;
    if (root === '/' && fragment.substr(0, 1) === '/') {
      return fragment;
    } else {
      return root + fragment;
    }
  } else {
    return '#' + fragment;
  }
});

;;
/*global viewTemplateOverrides, createErrorMessage */
Handlebars.registerViewHelper('view', {
  factory: function(args, options) {
    var View = args.length >= 1 ? args[0] : Thorax.View;
    return Thorax.Util.getViewInstance(View, options.options);
  },
  // ensure generated placeholder tag in template
  // will match tag of view instance
  modifyHTMLAttributes: function(htmlAttributes, instance) {
    // Handle fruitloops tag name lookup via the .name case.
    htmlAttributes.tagName = (instance.el.tagName || instance.el.name || '').toLowerCase();
  },
  callback: function(view) {
    var instance = arguments[arguments.length-1],
        options = instance._helperOptions.options,
        placeholderId = instance.cid;
    // view will be the argument passed to the helper, if it was
    // a string, a new instance was created on the fly, ok to pass
    // hash arguments, otherwise need to throw as templates should
    // not introduce side effects to existing view instances
    if (!_.isString(view) && options.hash && _.keys(options.hash).length > 0) {
      throw new Error(createErrorMessage('view-helper-hash-args'));
    }
    if (options.fn) {
      viewTemplateOverrides[placeholderId] = options.fn;
    }
  }
});

;;
/*global $serverSide, inheritVars */

inheritVars.model.defaultOptions.populate = true;

var oldModelChange = inheritVars.model.change;
inheritVars.model.change = function(view, model, options) {
  view._isChanging = true;
  oldModelChange.apply(view, arguments);
  view._isChanging = false;

  if (options && options.serializing) {
    return;
  }

  var populate = populateOptions(view);
  if (view._renderCount && populate) {
    view.populate(!populate.context && view.model.attributes, populate);
  }
};

_.extend(Thorax.View.prototype, {
  //serializes a form present in the view, returning the serialized data
  //as an object
  //pass {set:false} to not update this.model if present
  //can pass options, callback or event in any order
  serialize: function() {
    var callback, options, event;
    //ignore undefined arguments in case event was null
    for (var i = 0; i < arguments.length; ++i) {
      if (_.isFunction(arguments[i])) {
        callback = arguments[i];
      } else if (_.isObject(arguments[i])) {
        if ('stopPropagation' in arguments[i] && 'preventDefault' in arguments[i]) {
          event = arguments[i];
        } else {
          options = arguments[i];
        }
      }
    }

    if (event && !this._preventDuplicateSubmission(event)) {
      return;
    }

    options = _.extend({
      set: true,
      validate: true,
      children: true
    }, options || {});

    var attributes = options.attributes || {};

    //callback has context of element
    var view = this;
    var errors = [];
    eachNamedInput(this, options, function($element, i, name, type) {
      var value = view._getInputValue($element, type);
      if (!_.isUndefined(value)) {
        objectAndKeyFromAttributesAndName(attributes, name, {mode: 'serialize'}, function(object, key) {
          if (!object[key]) {
            object[key] = value;
          } else if (_.isArray(object[key])) {
            object[key].push(value);
          } else {
            object[key] = [object[key], value];
          }
        });
      }
    });

    if (!options._silent) {
      this.trigger('serialize', attributes, options);
    }

    if (options.validate) {
      var validateInputErrors = this.validateInput(attributes);
      if (validateInputErrors && validateInputErrors.length) {
        errors = errors.concat(validateInputErrors);
      }
      this.trigger('validate', attributes, errors, options);
      if (errors.length) {
        this.trigger('invalid', errors);
        return;
      }
    }

    if (options.set && this.model) {
      if (!this.model.set(attributes, {silent: options.silent, serializing: true})) {
        return false;
      }
    }

    var self = this;
    callback && callback.call(this, attributes, function() {
      resetSubmitState(self);
    });
    return attributes;
  },

  _preventDuplicateSubmission: function(event, callback) {
    event.preventDefault();

    var form = $(event.target);
    if ((event.target.tagName || '').toLowerCase() !== 'form') {
      // Handle non-submit events by gating on the form
      form = $(event.target).closest('form');
    }

    if (!form.attr('data-submit-wait')) {
      form.attr('data-submit-wait', 'true');
      if (callback) {
        callback.call(this, event);
      }
      return true;
    } else {
      return false;
    }
  },

  //populate a form from the passed attributes or this.model if present
  populate: function(attributes, options) {
    options = _.extend({
      children: true
    }, options || {});

    var value,
        attributes = attributes || this._getContext();

    //callback has context of element
    eachNamedInput(this, options, function($element, i, name, type) {
      objectAndKeyFromAttributesAndName(attributes, name, {mode: 'populate'}, function(object, key) {
        value = object && object[key];

        if (!_.isUndefined(value)) {
          //will only execute if we have a name that matches the structure in attributes
          var isBinary = type === 'checkbox' || type === 'radio';
          if (isBinary) {
            value = _.isBoolean(value) ? value : value === $element.val();
            $element[value ? 'attr' : 'removeAttr']('checked', 'checked');
          } else {
            $element.val(value);
          }
        }
      });
    });

    ++this._populateCount;
    if (!options._silent) {
      this.trigger('populate', attributes);
    }
  },

  //perform form validation, implemented by child class
  validateInput: function(/* attributes, options, errors */) {},

  _getInputValue: function($input, type) {
    if (type === 'checkbox' || type === 'radio') {
      // `prop` doesn't exist in fruit-loops, but it updates after user input.
      // whereas attr does not.
      var checked = $input[$input.prop ? 'prop' : 'attr']('checked');
      if (checked || checked === '') {
        // Under older versions of IE we see 'on' when no value is set so we want to cast this
        // to true.
        var value = $input.attr('value');
        return (value === 'on') || value || true;
      }
    } else {
      return $input.val() || '';
    }
  },

  _populateCount: 0
});

// Keeping state in the views
Thorax.View.on({
  'before:rendered': function() {
    // Do not store previous options if we have not rendered or if we have changed the associated
    // model since the last render
    if (!this._renderCount || (this.model && this.model.cid) !== this._formModelCid) {
      return;
    }

    var modelOptions = this.getObjectOptions(this.model);
    // When we have previously populated and rendered the view, reuse the user data
    this.previousFormData = filterObject(
      this.serialize(_.extend({ set: false, validate: false, _silent: true }, modelOptions)),
      function(value) { return value !== '' && value != null; }
    );
  },
  rendered: function() {
    var populate = populateOptions(this);

    if (populate && !this._isChanging && !this._populateCount) {
      this.populate(!populate.context && this.model.attributes, populate);
    }
    if (this.previousFormData) {
      this.populate(this.previousFormData, _.extend({_silent: true}, populate));
    }

    this._formModelCid = this.model && this.model.cid;
    this.previousFormData = null;
  }
});

function filterObject(object, callback) {
  _.each(object, function (value, key) {
    if (_.isObject(value)) {
      return filterObject(value, callback);
    }
    if (callback(value, key, object) === false) {
      delete object[key];
    }
  });
  return object;
}

if (!$serverSide) {
  Thorax.View.on({
    invalid: onErrorOrInvalidData,
    error: onErrorOrInvalidData,
    deactivated: function() {
      if (this.$el) {
        resetSubmitState(this);
      }
    }
  });
}

function onErrorOrInvalidData () {
  resetSubmitState(this);

  // If we errored with a model we want to reset the content but leave the UI
  // intact. If the user updates the data and serializes any overwritten data
  // will be restored.
  if (this.model && this.model.previousAttributes) {
    this.model.set(this.model.previousAttributes(), {
      silent: true
    });
  }
}

function eachNamedInput(view, options, iterator) {
  var i = 0;

  $('select,input,textarea', options.root || view.el).each(function() {
    var $el = $(this);

    if (!options.children) {
      if (view.el !== $el.view({el: true, helper: false})[0]) {
        return;
      }
    }

    var type = $el.attr('type'),
        name = $el.attr('name');
    if (type !== 'button' && type !== 'cancel' && type !== 'submit' && name) {
      iterator($el, i, name, type);
      ++i;
    }
  });
}

//calls a callback with the correct object fragment and key from a compound name
function objectAndKeyFromAttributesAndName(attributes, name, options, callback) {
  var key,
      object = attributes,
      keys = name.split('['),
      mode = options.mode;

  for (var i = 0; i < keys.length - 1; ++i) {
    key = keys[i].replace(']', '');
    if (!object[key]) {
      if (mode === 'serialize') {
        object[key] = {};
      } else {
        return callback(undefined, key);
      }
    }
    object = object[key];
  }
  key = keys[keys.length - 1].replace(']', '');
  callback(object, key);
}

function resetSubmitState(view) {
  view.$('form').removeAttr('data-submit-wait');
  view.$el.removeAttr('data-submit-wait');
}

function populateOptions(view) {
  var modelOptions = view.getObjectOptions(view.model) || {};
  return modelOptions.populate === true ? {} : modelOptions.populate;
}

;;
/* global createErrorMessage, normalizeHTMLAttributeOptions */

var callMethodAttributeName = 'data-call-method',
    triggerEventAttributeName = 'data-trigger-event';

Handlebars.registerHelper('button', function(method, options) {
  if (arguments.length === 1) {
    options = method;
    method = options.hash.method;
  }
  var hash = options.hash,
      expandTokens = hash['expand-tokens'];
  delete hash['expand-tokens'];
  if (!method && !options.hash.trigger) {
    throw new Error(createErrorMessage('button-trigger'));
  }
  normalizeHTMLAttributeOptions(hash);
  hash.tagName = hash.tagName || 'button';
  hash.trigger && (hash[triggerEventAttributeName] = hash.trigger);
  delete hash.trigger;
  method && (hash[callMethodAttributeName] = method);
  return new Handlebars.SafeString(Thorax.Util.tag(hash, options.fn ? options.fn(this) : '', expandTokens ? this : null));
});

Handlebars.registerHelper('link', function() {
  var args = _.toArray(arguments),
      options = args.pop(),
      hash = options.hash,
      // url is an array that will be passed to the url helper
      url = args.length === 0 ? [hash.href] : args,
      expandTokens = hash['expand-tokens'];
  delete hash['expand-tokens'];
  if (!url[0] && url[0] !== '') {
    throw new Error(createErrorMessage('link-href'));
  }
  normalizeHTMLAttributeOptions(hash);
  url.push(options);
  hash.href = Handlebars.helpers.url.apply(this, url);
  hash.tagName = hash.tagName || 'a';
  hash.trigger && (hash[triggerEventAttributeName] = options.hash.trigger);
  delete hash.trigger;
  hash[callMethodAttributeName] = '_anchorClick';
  return new Handlebars.SafeString(Thorax.Util.tag(hash, options.fn ? options.fn(this) : '', expandTokens ? this : null));
});

var clickSelector = '[' + callMethodAttributeName + '], [' + triggerEventAttributeName + ']';

function handleClick(event) {
  var $this = $(this),
      view = $this.view({helper: false}),
      methodName = $this.attr(callMethodAttributeName),
      eventName = $this.attr(triggerEventAttributeName),
      methodResponse = false;
  methodName && (methodResponse = view[methodName](event));
  eventName && view.trigger(eventName, event);
  this.tagName === 'A' && methodResponse === false && event.preventDefault();
}

var lastClickHandlerEventName;

function registerClickHandler() {
  unregisterClickHandler();
  lastClickHandlerEventName = Thorax._fastClickEventName || 'click';
  $(document).on(lastClickHandlerEventName, clickSelector, handleClick);
}

function unregisterClickHandler() {
  lastClickHandlerEventName && $(document).off(lastClickHandlerEventName, clickSelector, handleClick);
}

$(document).ready(function() {
  if (!Thorax._fastClickEventName) {
    registerClickHandler();
  }
});

;;
/*global normalizeHTMLAttributeOptions */
var elementPlaceholderAttributeName = 'data-element-tmp';

Handlebars.registerHelper('element', function(element, options) {
  normalizeHTMLAttributeOptions(options.hash);
  var cid = _.uniqueId('element'),
      declaringView = options.data.view;
  options.hash[elementPlaceholderAttributeName] = cid;
  declaringView._elementsByCid || (declaringView._elementsByCid = {});
  declaringView._elementsByCid[cid] = element;

  // Register the append helper if not already done
  if (!declaringView._pendingElement) {
    declaringView._pendingElement = true;
    declaringView.once('append', elementAppend);
  }

  return new Handlebars.SafeString(Thorax.Util.tag(options.hash));
});

function elementAppend(scope, callback) {
  this._pendingElement = undefined;

  var self = this;
  (scope || this.$el).find('[' + elementPlaceholderAttributeName + ']').forEach(function(el) {
    var $el = $(el),
        cid = $el.attr(elementPlaceholderAttributeName),
        element = self._elementsByCid[cid];
    // A callback function may be specified as the value
    if (_.isFunction(element)) {
      element = element.call(self);
    }
    $el.replaceWith(element);
    callback && callback($(element));
  });
}

;;
/* global createErrorMessage */

Handlebars.registerHelper('super', function(options) {
  var declaringView = options.data.view,
      parent = declaringView.constructor && declaringView.constructor.__super__;
  if (parent) {
    var template = parent.template;
    if (!template) {
      if (!parent.name) {
        throw new Error(createErrorMessage('super-parent'));
      }
      template = parent.name;
    }
    if (_.isString(template)) {
      template = Thorax.Util.getTemplate(template, false);
    }
    return new Handlebars.SafeString(template(this, options));
  } else {
    return '';
  }
});

;;
/*global $serverSide, createErrorMessage, inheritVars */

var loadStart = 'load:start',
    loadEnd = 'load:end',
    rootObject;

Thorax.setRootObject = function(obj) {
  rootObject = obj;
};

Thorax.loadHandler = function(start, end, context) {
  var loadCounter = _.uniqueId('load');
  return function(message, background, object) {
    if ($serverSide) {
      return;
    }

    var self = context || this;
    self._loadInfo = self._loadInfo || {};
    var loadInfo = self._loadInfo[loadCounter];

    function startLoadTimeout() {

      // If the timeout has been set already but has not triggered yet do nothing
      // Otherwise set a new timeout (either initial or for going from background to
      // non-background loading)
      if (loadInfo.timeout && !loadInfo.run) {
        return;
      }

      var loadingTimeout = self._loadingTimeoutDuration !== undefined ?
        self._loadingTimeoutDuration : Thorax.View.prototype._loadingTimeoutDuration;
      loadInfo.timeout = setTimeout(
          Thorax.bindSection('load-start', function() {
            // We have a slight race condtion in here where the end event may have occurred
            // but the end timeout has not executed. Rather than killing a cumulative timeout
            // immediately we'll protect from that case here
            if (loadInfo.events.length) {
              loadInfo.run = true;
              start.call(self, loadInfo.message, loadInfo.background, loadInfo);
            }
          }),
        loadingTimeout * 1000);
    }

    if (!loadInfo) {
      loadInfo = self._loadInfo[loadCounter] = _.extend({
        isLoading: function() {
          return loadInfo.events.length;
        },

        cid: loadCounter,
        events: [],
        timeout: 0,
        message: message,
        background: !!background
      }, Backbone.Events);
      startLoadTimeout();
    } else {
      clearTimeout(loadInfo.endTimeout);

      loadInfo.message = message;
      if (!background && loadInfo.background) {
        loadInfo.background = false;
        startLoadTimeout();
      }
    }

    // Prevent binds to the same object multiple times as this can cause very bad things
    // to happen for the load;load;end;end execution flow.
    if (_.indexOf(loadInfo.events, object) >= 0) {
      return;
    }

    loadInfo.events.push(object);

    // Must be defined as a variable rather than a named function as a parameter as oldIE
    // isn't able to properly remove the callback when using that syntax
    var endCallback = function() {
      var loadingEndTimeout = self._loadingTimeoutEndDuration;
      if (loadingEndTimeout === void 0) {
        // If we are running on a non-view object pull the default timeout
        loadingEndTimeout = Thorax.View.prototype._loadingTimeoutEndDuration;
      }

      var events = loadInfo.events,
          index = _.indexOf(events, object);
      if (index >= 0 && !object.isLoading()) {
        events.splice(index, 1);

        if (_.indexOf(events, object) < 0) {
          // Last callback for this particlar object, remove the bind
          object.off(loadEnd, endCallback);
        }
      }

      if (!events.length) {
        clearTimeout(loadInfo.endTimeout);
        loadInfo.endTimeout = setTimeout(
          Thorax.bindSection('load-end', function() {
            if (!events.length) {
              if (loadInfo.run) {
                // Emit the end behavior, but only if there is a paired start
                end && end.call(self, loadInfo.background, loadInfo);
                loadInfo.trigger(loadEnd, loadInfo);
              }

              // If stopping make sure we don't run a start
              clearTimeout(loadInfo.timeout);
              loadInfo = self._loadInfo[loadCounter] = undefined;
            }
          }),
        loadingEndTimeout * 1000);
      }
    };
    object.on(loadEnd, endCallback);
  };
};

/**
 * Helper method for propagating load:start events to other objects.
 *
 * Forwards load:start events that occur on `source` to `dest`.
 */
Thorax.forwardLoadEvents = function(source, dest, once) {
  function load(message, backgound, object) {
    if (once) {
      source.off(loadStart, load);
    }
    dest.trigger(loadStart, message, backgound, object);
  }
  source.on(loadStart, load);
  return {
    off: function() {
      source.off(loadStart, load);
    }
  };
};

//
// Data load event generation
//

/**
 * Mixing for generating load:start and load:end events.
 */
Thorax.mixinLoadable = function(target, useParent) {
  _.extend(target, {
    //loading config
    _loadingClassName: 'loading',
    _loadingTimeoutDuration: 0.33,
    _loadingTimeoutEndDuration: 0.10,

    // Propagates loading view parameters to the AJAX layer
    onLoadStart: function(message, background, object) {
      var that = useParent ? this.parent : this;

      // Protect against race conditions
      if (!that || !that.el) {
        return;
      }

      if (!that.nonBlockingLoad && !background && rootObject && rootObject !== this) {
        rootObject.trigger(loadStart, message, background, object);
      }
      that._isLoading = true;
      that.$el.addClass(that._loadingClassName);
      // used by loading helpers
      that.trigger('change:load-state', 'start', background);
    },
    onLoadEnd: function(/* background, object */) {
      var that = useParent ? this.parent : this;

      // Protect against race conditions
      if (!that || !that.el) {
        return;
      }

      that._isLoading = false;
      that.$el.removeClass(that._loadingClassName);
      // used by loading helper
      that.trigger('change:load-state', 'end');
    }
  });
};

Thorax.mixinLoadableEvents = function(target, useParent) {
  _.extend(target, {
    _loadCount: 0,

    isLoading: function() {
      return this._loadCount > 0;
    },

    loadStart: function(message, background) {
      this._loadCount++;

      var that = useParent ? this.parent : this;
      that.trigger(loadStart, message, background, that);
    },
    loadEnd: function() {
      this._loadCount--;

      var that = useParent ? this.parent : this;
      that.trigger(loadEnd, that);
    }
  });
};

Thorax.mixinLoadable(Thorax.View.prototype);
Thorax.mixinLoadableEvents(Thorax.View.prototype);


if (Thorax.HelperView) {
  Thorax.mixinLoadable(Thorax.HelperView.prototype, true);
  Thorax.mixinLoadableEvents(Thorax.HelperView.prototype, true);
}

if (Thorax.CollectionHelperView) {
  Thorax.mixinLoadable(Thorax.CollectionHelperView.prototype, true);
  Thorax.mixinLoadableEvents(Thorax.CollectionHelperView.prototype, true);
}

Thorax.sync = function(method, dataObj, options) {
  var self = this,
      complete = options.complete;

  options.complete = function() {
    self._request = undefined;
    self._aborted = false;

    complete && complete.apply(this, arguments);
  };
  this._request = Backbone.sync.apply(this, arguments);

  return this._request;
};

// Tracks the last route that has been emitted.
// This allows bindToRoute to differentiate between route events that are
// associated with the current handler's execution (as the route event triggers after)
// and with subsequent operations.
//
// This allows for bindToRoute to safely cleanup pending operations for the edge case
// where callers are calling `loadUrl` directly on the same fragment repeatidly.
var triggeredRoute,
    $loadUrl = Backbone.History.prototype.loadUrl;

Backbone.History.prototype.loadUrl = function() {
  Backbone.history.once('route', function() {
    triggeredRoute = Backbone.history.getFragment();
  });
  triggeredRoute = false;
  return $loadUrl.apply(this, arguments);
};

function bindToRoute(callback, failback) {
  var started = Backbone.History.started,
      fragment = started && Backbone.history.getFragment(),
      pendingRoute = triggeredRoute !== fragment;   // Has the `route` event triggered for this particular event?

  function routeHandler() {
    if (!started) {
      // If we were not started when this was initiated, reset ourselves to use the current route
      // as we can not trust the route that was given prior to the history object being configured
      fragment = Backbone.history.getFragment();
      pendingRoute = started = true;
    }
    if (pendingRoute && fragment === Backbone.history.getFragment()) {
      // The bind to route occured in the handler and the route event
      // was not yet triggered so we do not want to terminate the bind
      pendingRoute = false;
      return;
    }

    // Otherwise the fragment has changed or the router was executed again on the same
    // fragment, which we consider to be a distinct operation for these purposes.
    callback = undefined;
    res.cancel();
    failback && failback();
  }

  Backbone.history.on('route', routeHandler);

  function finalizer() {
    Backbone.history.off('route', routeHandler);
    if (callback) {
      callback.apply(this, arguments);
    }
  }

  var res = _.bind(finalizer, this);
  res.cancel = function() {
    Backbone.history.off('route', routeHandler);
  };

  return res;
}

function loadData(dataObj, callback, failback, options) {
  if (dataObj.isPopulated()) {
    // Defer here to maintain async callback behavior for all loading cases
    return _.defer(callback, dataObj);
  }

  if (arguments.length === 2 && !_.isFunction(failback) && _.isObject(failback)) {
    options = failback;
    failback = false;
  }

  var self = dataObj,
      routeChanged = false,
      successCallback = bindToRoute(_.bind(callback, self), function() {
        routeChanged = true;

        // Manually abort this particular load cycle (and only this one)
        queueEntry && queueEntry.aborted();

        // Kill off the request if there isn't anyone remaining who may want to interact
        // with it.
        if (self._request && (!self.fetchQueue || !self.fetchQueue.length)) {
          self._aborted = true;
          self._request.abort();
        }

        failback && failback.call(self, false);
      }),
      queueEntry;

  dataObj.fetch(_.defaults({
    success: successCallback,
    error: function() {
      successCallback.cancel();
      if (!routeChanged && failback) {
        failback.apply(self, [true].concat(_.toArray(arguments)));
      }
    }
  }, options));

  queueEntry = _.last(dataObj.fetchQueue);
}

function fetchQueue(dataObj, options, $super) {
  if (options.resetQueue) {
    // WARN: Should ensure that loaders are protected from out of band data
    //    when using this option
    dataObj.fetchQueue = undefined;
  } else if (dataObj.fetchQueue) {
    // concurrent set/reset fetch events are not advised
    var reset = (dataObj.fetchQueue[0].options || {}).reset;
    if (reset !== options.reset) {
      // fetch with concurrent set & reset not allowed
      throw new Error(createErrorMessage('mixed-fetch'));
    }
  }

  if (!dataObj.fetchQueue) {
    // Kick off the request
    dataObj.fetchQueue = [];
    var requestOptions = _.defaults({
      success: flushQueue(dataObj, dataObj.fetchQueue, 'success'),
      error: flushQueue(dataObj, dataObj.fetchQueue, 'error'),
      complete: flushQueue(dataObj, dataObj.fetchQueue, 'complete')
    }, options);

    // Handle callers that do not pass in a super class and wish to implement their own
    // fetch behavior
    if ($super) {
      var promise = $super.call(dataObj, requestOptions);
      if (dataObj.fetchQueue) {
        // ensure the fetchQueue has not been cleared out - https://github.com/walmartlabs/thorax/issues/304
        // This can occur in some environments if the request fails sync to this call, causing the 
        // error handler to clear out the fetchQueue before we get to this point.
        dataObj.fetchQueue._promise = promise;
      } else {
        return;
      }
    } else {
      return requestOptions;
    }
  }

  // Create a proxy promise for this specific load call. This allows us to abort specific
  // callbacks when bindToRoute needs to kill off specific callback instances.
  var deferred;
  if ($.Deferred && dataObj.fetchQueue._promise && dataObj.fetchQueue._promise.then) {
    deferred = $.Deferred();
    dataObj.fetchQueue._promise.then(
        _.bind(deferred.resolve, deferred),
        _.bind(deferred.reject, deferred));
  }

  var fetchQueue = dataObj.fetchQueue;
  dataObj.fetchQueue.push({
    // Individual requests can only fail individually. Success willl always occur via the
    // normal xhr path
    aborted: function() {
      var index = _.indexOf(fetchQueue, this);
      if (index >= 0) {
        fetchQueue.splice(index, 1);

        // If we are the last of the fetchQueue entries, invalidate the queue.
        if (!fetchQueue.length && fetchQueue === dataObj.fetchQueue) {
          dataObj.fetchQueue = undefined;
        }
      }

      var args = [fetchQueue._promise, 'abort'];
      deferred && deferred.rejectWith(options.context, args);
      options.error && options.error.apply(options.context, args);
      options.complete && options.complete.apply(options.context, args);
    },
    options: options
  });

  return deferred ? deferred.promise() : dataObj.fetchQueue._promise;
}

function flushQueue(self, fetchQueue, handler) {
  return function() {
    var args = arguments;

    // Flush the queue. Executes any callback handlers that
    // may have been passed in the fetch options.
    _.each(fetchQueue, function(queue) {
      var options = queue.options;

      if (options[handler]) {
        options[handler].apply(this, args);
      }
    }, this);

    // Reset the queue if we are still the active request
    if (self.fetchQueue === fetchQueue) {
      self.fetchQueue = undefined;
    }
  };
}

var klasses = [];
Thorax.Model && klasses.push(Thorax.Model);
Thorax.Collection && klasses.push(Thorax.Collection);

_.each(klasses, function(DataClass) {
  var $fetch = DataClass.prototype.fetch;
  Thorax.mixinLoadableEvents(DataClass.prototype, false);
  _.extend(DataClass.prototype, {
    sync: Thorax.sync,

    fetch: function(options) {
      options = options || {};
      if (DataClass === Thorax.Collection) {
        if (!_.find(['reset', 'remove', 'add', 'update'], function(key) { return !_.isUndefined(options[key]); })) {
          // use backbone < 1.0 behavior to allow triggering of reset events
          options.reset = true;
        }
      }

      if (!options.loadTriggered) {
        var self = this;

        function endWrapper(method) {
          var $super = options[method];
          options[method] = function() {
            self.loadEnd();
            $super && $super.apply(this, arguments);
          };
        }

        endWrapper('success');
        endWrapper('error');
        self.loadStart(undefined, options.background);
      }

      return fetchQueue(this, options || {}, $fetch);
    },

    load: function(callback, failback, options) {
      if (arguments.length === 2 && !_.isFunction(failback)) {
        options = failback;
        failback = false;
      }

      options = options || {};
      if (!options.background && !this.isPopulated() && rootObject) {
        // Make sure that the global scope sees the proper load events here
        // if we are loading in standalone mode
        if (this.isLoading()) {
          // trigger directly because load:start has already been triggered
          rootObject.trigger(loadStart, options.message, options.background, this);
        } else {
          Thorax.forwardLoadEvents(this, rootObject, true);
        }
      }

      loadData(this, callback, failback, options);
    }
  });
});

Thorax.Util.bindToRoute = bindToRoute;

// Propagates loading view parameters to the AJAX layer
Thorax.View.prototype._modifyDataObjectOptions = function(dataObject, options) {
  options.ignoreErrors = this.ignoreFetchError;
  options.background = this.nonBlockingLoad;
  return options;
};

// Thorax.CollectionHelperView inherits from CollectionView
// not HelperView so need to set it manually
Thorax.HelperView.prototype._modifyDataObjectOptions = Thorax.CollectionHelperView.prototype._modifyDataObjectOptions = function(dataObject, options) {
  options.ignoreErrors = this.parent.ignoreFetchError;
  options.background = this.parent.nonBlockingLoad;
  return options;
};

inheritVars.collection.loading = function(view) {
  var loadingView = view.loadingView,
      loadingTemplate = view.loadingTemplate,
      loadingPlacement = view.loadingPlacement;
  //add "loading-view" and "loading-template" options to collection helper
  if (loadingView || loadingTemplate) {
    var callback = Thorax.loadHandler(function() {
      var item;
      if (view.collection.length === 0) {
        view.$el.empty();
      }
      if (loadingView) {
        var instance = Thorax.Util.getViewInstance(loadingView);
        view._addChild(instance);
        if (loadingTemplate) {
          instance.render(loadingTemplate);
        } else {
          instance.render();
        }
        item = instance;
      } else {
        item = view.renderTemplate(loadingTemplate);
      }
      var index = loadingPlacement
        ? loadingPlacement.call(view)
        : view.collection.length
      ;
      view.appendItem(item, index);
      view.$el.children().eq(index).attr('data-loading-element', view.collection.cid);
    }, function() {
      view.$el.find('[data-loading-element="' + view.collection.cid + '"]').remove();
    },
    view.collection);

    view.listenTo(view.collection, 'load:start', callback);
  }
};

if (Thorax.CollectionHelperView) {
  _.extend(Thorax.CollectionHelperView.attributeWhiteList, {
    'loading-template': 'loadingTemplate',
    'loading-view': 'loadingView',
    'loading-placement': 'loadingPlacement'
  });
}

Thorax.View.on({
  'load:start': Thorax.loadHandler(
      function(message, background, object) {
        this.onLoadStart(message, background, object);
      },
      function(background, object) {
        this.onLoadEnd(object);
      }),

  collection: {
    'load:start': function(message, background, object) {
      this.trigger(loadStart, message, background, object);
    }
  },
  model: {
    'load:start': function(message, background, object) {
      this.trigger(loadStart, message, background, object);
    }
  }
});

;;
Handlebars.registerHelper('loading', function(options) {
  var view = options.data.view;
  view.off('change:load-state', onLoadStateChange, view);
  view.on('change:load-state', onLoadStateChange, view);
  return view._isLoading ? options.fn(this) : options.inverse(this);
});

function onLoadStateChange() {
  this.render();
}

;;


})();


