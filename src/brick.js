import registry    from "./brick-registry";
import Twig        from "twig";
import BrickFinder from "./brick-finder";
import AppEvent    from "./app-event";


/**
 * @property {HTMLElement} root;
 * @property {DOMStringMap} dataset;
 */
export default class Brick {


	/* --- BRICK OPTIONS ----*/


	/**
	 * @param {typeof Brick} target
	 * @param {string} option
	 * @param {*} value
	 */
	static setOption(target, option, value = null) {
		this.setDefaultOptions(target);
		target.options[option] = value;
	}

	/**
	 * @param {typeof Brick} target
	 */
	static setDefaultOptions(target) {
		if (typeof target.options === 'undefined') target.options = {
			renderOnConstruct: true,
			cleanOnConstruct: true,
			observeAttributes: false,
			observedAttributes: false,
			registerSubBricksOnRender: false,
			rootCssClasses: []
		};
	}


	/* --- DECORATORS ----*/


	/**
	 * @param {string} tag
	 * @param {Function} twig
	 */
	static register(tag, twig = null) {
		return (target) => {
			if (typeof target.tag === "undefined") target.tag = "";
			target.tag = target.tag + tag;
			target.tag = tag;
			target.twig = twig;
			this.setDefaultOptions(target);
			registry.register(target);
		};
	}

	/**
	 * @param {boolean} value
	 * @returns {Function}
	 */
	static cleanOnConstruct(value = true) { return (target) => { this.setOption(target, 'cleanOnConstruct', value); }; }

	/**
	 * @param {boolean} value
	 * @returns {Function}
	 */
	static renderOnConstruct(value = true) { return (target) => { this.setOption(target, 'renderOnConstruct', value); }; }

	/**
	 * @param {boolean} value
	 * @returns {Function}
	 */
	static registerSubBricksOnRender(value = true) { return (target) => { this.setOption(target, 'registerSubBricksOnRender', value); }; }
	/**
	 * @param {string | Array<string>} value
	 * @returns {Function}
	 */
	static addClass(value) {return (target) => { this.setOption(target, 'rootCssClasses', typeof value === 'string' ? [value] : value);}; }
	/**
	 * @param {boolean} value
	 * @param {null | Array<string>} attributes
	 * @returns {Function}
	 */
	static observeAttributes(value, attributes = null) {
		return (target) => {
			this.setOption(target, 'observeAttributes', value);
			if (attributes) {
				this.setOption(target, 'observedAttributes', attributes);
			}
		};
	}


	/* --- STATIC ----*/


	/**
	 * @returns {string}
	 */
	static get selector() {return `[is="${this.tag}"]`;}


	/**
	 * @param {string} tag
	 * @param {boolean} render
	 * @returns {Promise<typeof Brick>}
	 */
	static create(tag = 'div', render = true) {
		let brick = new (this)(this.createBrickElement(tag), false);
		if (render) return brick.render();
		else return Promise.resolve(brick);
	}

	/**
	 * @param {string} tag
	 * @returns {HTMLElement}
	 */
	static createBrickElement(tag = 'div') {
		let element = document.createElement(tag);
		element.setAttribute('is', this.tag);
		return element;
	}


	/* --- CONSTRUCTOR ----*/


	/**
	 * @param {HTMLElement} root
	 * @param {boolean} renderOnConstruct
	 */
	constructor(root, renderOnConstruct = true) {
		this.root = this.eventSource = root;
		this.root.controller = this;
		this.dataset = this.root.dataset;

		this.constructor.options.rootCssClasses.forEach((cssclass) => {this.root.classList.add(cssclass);});

		if (this.constructor.options.observeAttributes === true) {
			let attr_mut_opts = {
				attributes: true,
				childList: false,
				subtree: false,
				attributeOldValue: true,
				attributeFilter: undefined
			};
			if (this.constructor.options.observedAttributes) attr_mut_opts.attributeFilter = this.constructor.options.observedAttributes;

			(new MutationObserver((mutationsList) => {
				mutationsList.forEach(mutation => {
					if (mutation.type === 'attributes') this.onAttributeChange(
						mutation.attributeName,
						this.root.getAttribute(mutation.attributeName),
						mutation.oldValue
					);
				});
			})).observe(this.root, attr_mut_opts);
		}

		this.root.setAttribute('brick-initialized', 'yes');

		this.onInitialize();


		if (this.constructor.options.cleanOnConstruct === true) this.clearContent();
		if (this.constructor.options.renderOnConstruct === true && this.constructor.twig && renderOnConstruct) this.render().then(() => {});
	}

	/**
	 */
	onInitialize() {

	}


	/**
	 * @param {string} attr
	 * @param {string} value
	 * @param {string} oldValue
	 */
	onAttributeChange(attr, value, oldValue) {
		console.warn(`You should implement your onAttributeChange method in "${this.constructor.tag}" brick! \n attribute "${attr}" changed: ${oldValue} -> ${value}`);
	};

	/* --- RENDER ----*/


	/**
	 * @param {Object} args
	 * @returns {Promise<typeof Brick>}
	 */
	render(args = undefined) {
		return Promise.resolve(this.beforeRender(args))
			.then(() => Promise.resolve(this.createViewModel()))
			.then(viewModel => this.renderTemplate(viewModel))
			.then(() => this.onRender())
			.then(() => this);
	}


	/**
	 * @param {*} args
	 * @returns {*}
	 */
	beforeRender(args) {return args;}

	/**
	 * @returns {Object}
	 */
	createViewModel() { return {}; }

	/**
	 */
	onRender() {}

	/**
	 * @param {Object} viewModel
	 * @returns {Promise}
	 */
	renderTemplate(viewModel) {
		let root = this.root;
		let twig = this.constructor.twig;
		let template = document.createElement('template');
		let content = '';
		if (typeof twig === 'function') content = twig(viewModel);
		if (typeof twig === 'string') content = Twig.twig({data: twig}).render(viewModel, {}, false);

		template.innerHTML = content;
		this.clearContent()
		root.appendChild(template.content.cloneNode(true));
		if (this.constructor.options.registerSubBricksOnRender) return registry.initializeElements(this.root);
		return Promise.resolve();
	}


	/**
	 * @param {string|null} selector
	 * @param {Function} func
	 * @returns {BrickFinder}
	 */
	$(selector = null, func = null) { return new BrickFinder(selector, this.root, this, func); }

	/**
	 * @param {string} role
	 * @param {Function} func
	 * @returns {BrickFinder}
	 */
	$$(role, func = null) { return new BrickFinder('[\\(' + role + '\\)]', this.root, this, func);}

	/**
	 * @param {string | Array<string>} event
	 * @param {Function} handler
	 */
	listen(event, handler) { AppEvent.listen(event, handler, this.root); }

	/**
	 * @param {string} event
	 * @param {*} data
	 * @param {{bubbles:boolean, cancelable: boolean}} options
	 */
	fire(event, data = null, options = {
		bubbles: true,
		cancelable: true
	}) {
		AppEvent.fire(event, data, options, this.eventSource);
	}

	clearContent(node = this.root) {
		while (node.firstChild) this.root.removeChild(node.firstChild);
	}

	requestAnimationFrame() { return new Promise(resolve => window.requestAnimationFrame(resolve));}
	wait(ms) { return new Promise(resolve => setTimeout(() => resolve(ms), ms)); }
}