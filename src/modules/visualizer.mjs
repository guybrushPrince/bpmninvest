import $ from 'jquery';
import { faultBus, FaultLevel } from "./faultbus.mjs";
import { asList, asObject, isObject, union } from "./settools.mjs";
import { PathFinderFactory } from "./pathfinder.mjs";
import { Node } from "./model.mjs";

import errorIcon from '../icons/error.svg';
import warningIcon from '../icons/warning.svg';
import infoIcon from '../icons/info.svg';
import pointerIcon from '../icons/pointer.svg';

// CSS classes for highlighting BPMN elements.
const VisClasses = {
    INFO_LINE: 'info-line',
    WARNING_LINE: 'warning-line',
    ERROR_LINE: 'error-line',
    PULSATING_ERROR_LINE: 'error-pulse',
    PULSATING_WARNING_LINE: 'warning-pulse',
    VISUALIZED_LINE: 'vis-line',

    ANALYSIS_HINT: 'note',
    ANALYSIS_HINT_VISIBLE: 'note show',
    DETAIL_OPENER: 'd-opener',
    DETAIL_PANEL: 'd-panel',
    ERROR_CONTAINER: 'err-con',

    HINT_FADE: 'hint-fade',
    NON_FADE: 'non-fade',

    HIGHLIGHT: 'highlight',
    SELECTED: 'selected',

    ERROR_LIST: 'error-list',
    ERROR_LIST_TITLE: 'title',
    ERROR_LIST_LIST: 'list'
};

// Texts being displayed in the editor.
const Texts = {
    QUESTION_MARK_HINT: 'Click to get detailed information.'
};

let registry = {};
let classes = {};

const Visualizer = function () {

    function VisualizerFactory() {

        let overlays;
        let elementRegistry;
        let modelerInstance;

        let errorNodeMap = {};

        let errorList;
        let overallErrorList;

        let that = this;

        this.initialize = function (modeler, faultBus, to = null) {
            modelerInstance = modeler;
            overlays = modeler.get('overlays');
            elementRegistry = modeler.get('elementRegistry')
            faultBus.subscribe(this);

            if (to === null) to = $('body');
            overallErrorList = $('<div class="' + VisClasses.ERROR_LIST + '"></div>');
            overallErrorList.append($('<div class="' + VisClasses.ERROR_LIST_TITLE + '">Flaws</div>'));
            errorList = $('<div class="' + VisClasses.ERROR_LIST_LIST + '"></div>');
            overallErrorList.append(errorList);
            to.append(overallErrorList);
        };

        this.destruct = function (unsubscribe = true) {
            if (unsubscribe) faultBus.unsubscribe(this);
            elementRegistry.getAll().forEach((el) => {
                $('[data-element-id="' + el.id + '"').removeClass(asList(VisClasses).concat(asList(classes)).join(' '));
            });
            if (unsubscribe) {
                overlays.clear();
                errorList.empty();
                overallErrorList.removeClass(VisClasses.SELECTED);
            }
        };
        this.reset = function () {
            this.destruct();
        };
        this.notify = function (type, process, elements, fault) {
            try {
                if (fault in registry) registry[fault].getVisualizer(type, process, elements, that, modelerInstance);
            } catch (exception) {
                console.error(exception);
            }
        };

        this.addOverlay = function (ui, type, text, detailAction = () => {}, detailClose = () => {}, show = false) {
            ui.toArray().forEach(u => {
                let id = $(u).data('element-id');
                if (id !== undefined) {
                    if (!(id in errorNodeMap)) errorNodeMap[id] = $('<div class="' + VisClasses.ERROR_CONTAINER + '"></div>');
                    let infoDiv = errorNodeMap[id];
                    let cl = show ? VisClasses.ANALYSIS_HINT_VISIBLE : VisClasses.ANALYSIS_HINT;
                    // The icon to print
                    let img = errorIcon;
                    let altImg = 'Crucial';
                    if (type === FaultLevel.WARNING) {
                        img = warningIcon;
                        altImg = 'Notable';
                    } else if (type === FaultLevel.INFO) {
                        img = infoIcon;
                        altImg = 'Knowable'
                    }
                    // The alternative

                    let noteDiv = $('<div class="' + cl + ' ' + type + '">' +
                        /*'<div><img src="' + img + '" alt="' + altImg + '"></div>' +*/
                        '<div>' + text + '</div></div>');
                    let noteDivList = noteDiv.clone();
                    noteDivList.addClass('el');

                    let openerDiv = $('<div class="' + VisClasses.DETAIL_OPENER + ' ' + type + '" title="' + Texts.QUESTION_MARK_HINT + '">?</div>');
                    let listOpenerDiv = openerDiv.clone();
                    noteDiv.append(openerDiv);
                    noteDivList.append(listOpenerDiv);


                    $(openerDiv).add(listOpenerDiv).on('click', (ev) => {
                        openDetailPanel(detailAction, detailClose);
                    });
                    $(noteDiv).add(noteDivList).on('mouseenter', (ev) => {
                        $('[data-element-id="' + id + '"').addClass(VisClasses.SELECTED);
                        $('.djs-overlays[data-container-id="' + id + '"').addClass(VisClasses.SELECTED);
                    });
                    $(noteDiv).add(noteDivList).on('mouseleave', (ev) => {
                        $('[data-element-id="' + id + '"').removeClass(VisClasses.SELECTED);
                        $('.djs-overlays[data-container-id="' + id + '"').removeClass(VisClasses.SELECTED);
                    });

                    infoDiv.append(noteDiv);
                    overlays.add(id, 'note', {
                        position: {
                            bottom: 10,
                            right: 10
                        },
                        html: infoDiv
                    });

                    overallErrorList.addClass(VisClasses.SELECTED);
                    errorList.append(noteDivList);
                }
            });
        };

        let openDetailPanel = function (action = () => {}, close = () => {}, to = null) {
            let b = (to === null ? $('body') : to);

            b.find('.' + VisClasses.DETAIL_PANEL).remove();
            that.fadeIn();
            let panel = $('<div class="' + VisClasses.DETAIL_PANEL + '"></div>');
            b.append(panel);
            let closer = $('<button id="close-panel" title="Close explanation">x</button>');
            panel.append(closer);
            closer.on('click', function () {
                panel.remove();
                that.fadeIn();
                close();
            });

            let panelCanvas = $('<div></div>');
            panel.append(panelCanvas);
            action(panelCanvas);
            that.addElementLinkFunctions(panel);
        }

        this.fadeOut = function () {
            elementRegistry.getAll().forEach((el) => {
                $('[data-element-id="' + el.id + '"').addClass(VisClasses.HINT_FADE);
            });
        };
        this.fadeIn = function () {
            elementRegistry.getAll().forEach((el) => {
                $('[data-element-id="' + el.id + '"').removeClass([
                    VisClasses.HINT_FADE,
                    VisClasses.NON_FADE,
                    VisClasses.PULSATING_ERROR_LINE,
                    VisClasses.PULSATING_WARNING_LINE
                ].join(' '));
            });
        };
        this.addInfoLine = function (ui) {
            that.addClass(ui, [
                VisClasses.VISUALIZED_LINE,
                VisClasses.INFO_LINE
            ]);
        };
        this.addWarningLine = function (ui) {
            that.addClass(ui, [
                VisClasses.VISUALIZED_LINE,
                VisClasses.WARNING_LINE
            ]);
        };
        this.addErrorLine = function (ui) {
            that.addClass(ui, [
                VisClasses.VISUALIZED_LINE,
                VisClasses.ERROR_LINE
            ]);
        };

        this.setFocus = function (toFocus = null, nonFade = null, pulsating = true, warning = false) {
            that.fadeOut();
            if (toFocus !== null) {
                let classes = [
                    VisClasses.VISUALIZED_LINE,
                    VisClasses.NON_FADE
                ];
                if (pulsating) {
                    if (!warning) classes = classes.concat([ VisClasses.PULSATING_ERROR_LINE ]);
                    else classes = classes.concat([ VisClasses.PULSATING_WARNING_LINE ]);
                }
                that.addClass(toFocus, classes, VisClasses.NON_FADE);
            }
            if (nonFade !== null) {
                that.addClass(nonFade, VisClasses.NON_FADE, true);
            }
        }


        this.mapToUI = function (set) {
            return [...new Set(asList(set).map(s => s.getUI$))];
        };
        this.mapModelToBPMNUI = function (set) {
            return PathFinderFactory(modelerInstance).mapNodeSetToBPMN(set).map(b => $('[data-element-id="' + b.id + '"]'));
        };
        this.addClass = function (ui, clazz, withParents = false) {
            if (Array.isArray(clazz)) clazz = clazz.join(' ');
            if (!Array.isArray(ui)) ui = [ ui ];
            ui.forEach(u => {
                u.addClass(clazz);
                if (withParents !== false) {
                    let cl = clazz;
                    if (withParents !== true) cl = withParents;
                    u.parents().addClass(cl);
                }
            });
            return that;
        };
        this.getElementLink = function (element) {
            if (isObject(element) && !(element instanceof Node)) {
                element = asList(element);
            }
            if (!Array.isArray(element)) element = [ element ];
            return element.map((el) => {
                let pathFinder = PathFinderFactory(modelerInstance);
                let orgs = pathFinder.mapNodeSetToBPMN(asObject([ el ]));
                let type = '', name = '';
                if (orgs.length >= 1) {
                    let org = orgs.shift();
                    type = org.type.substring(5);
                    name = '';
                    if ('businessObject' in org && 'name' in org.businessObject && org.businessObject.name !== '' &&
                        org.businessObject.name !== null && org.businessObject.name !== undefined) {
                        name = ' "' + org.businessObject.name + '"';
                    }
                }
                return '<a data-element-link=\'' + JSON.stringify(asList(el.elementIds)) + '\'>' +
                    '<img src="' + pointerIcon + '" alt="A pointer symbol."> ' + type + name + '</a>';
            }).join(', ');
        };

        this.addElementLinkFunctions = function (panel) {
            panel.find('a[data-element-link]').on('mouseover', function () {
                let link = $(this).data('element-link');
                if (link !== null && link !== undefined) {
                    let sel = link.map(l => '[data-element-id="' + l + '"]').join(',');
                    $(sel).addClass(VisClasses.HIGHLIGHT);
                }
            }).on('mouseout', function () {
                let link = $(this).data('element-link');
                if (link !== null && link !== undefined) {
                    let sel = link.map(l => '[data-element-id="' + l + '"]').join(',');
                    $(sel).removeClass(VisClasses.HIGHLIGHT);
                }
            });
        };

        this.appendFaultKind = function (panel, typeKinds) {
            if (!Array.isArray(typeKinds)) typeKinds = [ typeKinds ];
            let kindContainer = $('<div class="kinds"></div>');
            typeKinds.forEach(typeKind => kindContainer.append('<div class="kind ' + typeKind.type + '">' + typeKind.kind + '</div>'));
            panel.append(kindContainer);
            return that;
        };

        this.register = function(visualizationModules) {
            if (!Array.isArray(visualizationModules)) visualizationModules = [ visualizationModules ];
            visualizationModules.forEach((visualizationModule) => {
                registry[visualizationModule.getFaultType] = visualizationModule;
                classes = union(classes, visualizationModule.getClasses);
            });
            return that;
        }
    }

    return (function () {
        return new VisualizerFactory();
    })();
};

export { Visualizer, VisClasses };