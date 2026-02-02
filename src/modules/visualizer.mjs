import $ from 'jquery';
import { faultBus } from "./faultbus.mjs";
import { asList, union } from "./settools.mjs";
import { PathFinderFactory } from "./pathfinder.mjs";

// CSS classes for highlighting BPMN elements.
const VisClasses = {
    INFO_LINE: 'info-line',
    WARNING_LINE: 'warning-line',
    ERROR_LINE: 'error-line',
    PULSATING_LINE: 'error-pulse',
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

        this.initialize = function (modeler, faultBus) {
            modelerInstance = modeler;
            overlays = modeler.get('overlays');
            elementRegistry = modeler.get('elementRegistry')
            faultBus.subscribe(this);

            let b = $('body');
            overallErrorList = $('<div class="' + VisClasses.ERROR_LIST + '"></div>');
            overallErrorList.append($('<div class="' + VisClasses.ERROR_LIST_TITLE + '">Flaws</div>'));
            errorList = $('<div class="' + VisClasses.ERROR_LIST_LIST + '"></div>');
            overallErrorList.append(errorList);
            b.append(overallErrorList);
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

        this.notify = function (type, process, elements, fault) {
            enhanceModel(type, process, elements, fault);
        };

        let enhanceModel = function (type, process, elements, fault) {
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
                    let noteDiv = $('<div class="' + cl + ' ' + type + '"><div>' + text + '</div></div>');
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

        let openDetailPanel = function (action = () => {}, close = () => {}) {
            let b = $('body');
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
                    VisClasses.PULSATING_LINE
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
                    classes = classes.concat([ VisClasses.PULSATING_LINE ]);
                }
                if (warning) {
                    classes = classes.concat([ VisClasses.WARNING_LINE ]);
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
        };

        this.register = function(visualizationModules) {
            if (!Array.isArray(visualizationModules)) visualizationModules = [ visualizationModules ];
            visualizationModules.forEach((visualizationModule) => {
                registry[visualizationModule.getFaultType] = visualizationModule;
                classes = union(classes, visualizationModule.getClasses);
            });
        }
    }

    return (function () {
        return new VisualizerFactory();
    })();
};

export { Visualizer, VisClasses };