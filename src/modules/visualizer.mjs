import $ from 'jquery';
import {faultBus, FaultType} from "./faultbus.mjs";
import {asList, asObject, union} from "./settools.mjs";
import {flatten} from "array-flatten";

const VisClasses = {
    INFO_LINE: 'vis-line info-line',
    WARNING_LINE: 'vis-line warning-line',
    ERROR_LINE: 'vis-line error-line',

    ANALYSIS_HINT: 'note',
    DETAIL_OPENER: 'd-opener',
    DETAIL_PANEL: 'd-panel',
    ERROR_CONTAINER: 'err-con',

    HINT_FADE: 'hint-fade',
    NON_FADE: 'non-fade'
};

const Texts = {
    IMPLICIT_START: 'Implicit start event',
    IMPLICIT_END: 'Implicit end event',
    GATEWAY_WITHOUT_MULTIPLE_FLOWS: 'The gateway has neither multiple incoming nor multiple outgoing flows',
    LOOP_EXIT_NOT_XOR: 'Wrong loop exit',
    POTENTIAL_DEADLOCK: 'Possible deadlock',
    POTENTIAL_LACK_OF_SYNCHRONIZATION: 'Possible missing synchronization'
};

const Visualizer = (function () {

    function VisualizerFactory() {

        let overlays;
        let elementRegistry;

        let errorNodeMap = {};

        this.initialize = function (modeler, faultBus) {
            overlays = modeler.get('overlays');
            elementRegistry = modeler.get('elementRegistry')
            faultBus.subscribe(this);
        }
        this.destruct = function () {
            faultBus.unsubscribe(this);
            elementRegistry.getAll().forEach((el) => {
                $('[data-element-id="' + el.id + '"').removeClass(asList(VisClasses).join(' '));
            });
        }

        this.notify = function (type, process, elements, fault) {
            enhanceModel(type, process, elements, fault);
        }

        let enhanceModel = function (type, process, elements, fault) {
            switch (fault) {
                case FaultType.IMPLICIT_START: {
                    visualizeImplicitStart(type, elements);
                } break;
                case FaultType.IMPLICIT_END: {
                    visualizeImplicitEnd(type, elements);
                } break;
                case FaultType.GATEWAY_WITHOUT_MULTIPLE_FLOWS: {
                    visualizeDefectGateway(type, elements);
                } break;
                case FaultType.LOOP_EXIT_NOT_XOR: {
                    visualizeLoopExitNotXor(type, elements);
                } break;
                case FaultType.POTENTIAL_DEADLOCK: {
                    visualizeDeadlock(type, elements);
                } break;
                case FaultType.POTENTIAL_LACK_OF_SYNCHRONIZATION: {
                    visualizeLackOfSynchronization(type, elements);
                } break;
            }
        };

        let visualizeImplicitStart = function (type, elements) {
            elements.forEach(el => {
                let ui = el.getUI$;
                ui.addClass(VisClasses.INFO_LINE);
                addOverlay(ui, type, Texts.IMPLICIT_START, () => {
                    fadeOut();
                    ui.parents().addClass(VisClasses.NON_FADE);
                    ui.addClass(VisClasses.NON_FADE);
                });
            });
        };

        let visualizeImplicitEnd = function (type, elements) {
            elements.forEach(el => {
                el.getUI$.addClass(VisClasses.INFO_LINE)
                addOverlay(el.getUI$, type, Texts.IMPLICIT_END);
            });
        };

        let visualizeDefectGateway = function (type, element) {
            element.getUI$.addClass(VisClasses.WARNING_LINE)
            addOverlay(element.getUI$, type, Texts.GATEWAY_WITHOUT_MULTIPLE_FLOWS);
        };

        let visualizeLoopExitNotXor = function (type, elements) {
            let loopExit = elements.exit;
            let loop = elements.loop;
            loop.getEdges;
            loopExit.getUI$.addClass(VisClasses.ERROR_LINE);
            addOverlay(loopExit.getUI$, type, Texts.LOOP_EXIT_NOT_XOR, () => {
                let loopUI = loop.getUI$;
                fadeOut();
                console.log(loop.getUI$);
                loopUI.toArray().forEach(el => {
                    el.parents().addClass(VisClasses.NON_FADE);
                    el.addClass(VisClasses.NON_FADE);
                });
            });
        };

        let visualizeDeadlock = function (type, elements) {
            let join = elements.join;
            let paths = elements.paths;
            addClass(join.getUI$, VisClasses.ERROR_LINE);
            addOverlay(join.getUI$, type, Texts.POTENTIAL_DEADLOCK, () => {
                paths[join.getId] = join;
                let ui = [...new Set(asList(paths).map(p => p.getUI$))];
                fadeOut();
                ui.forEach(el => {
                    el.parents().addClass(VisClasses.NON_FADE);
                    el.addClass(VisClasses.NON_FADE);
                });
            });
        };

        let visualizeLackOfSynchronization = function (type, elements) {
            let intersectionPoint = elements.intersectionPoint;
            let split = elements.split;
            let postset = elements.postset;
            console.log([ intersectionPoint, split, postset ]);
            addClass(intersectionPoint.getUI$, VisClasses.ERROR_LINE);
            addOverlay(intersectionPoint.getUI$, type, Texts.POTENTIAL_LACK_OF_SYNCHRONIZATION, () => {
                fadeOut();
                let causeUI = split.getUI$;
                addClass(causeUI, 'cause');
                let subCauseUI = [...new Set(asList(postset).map(p => p.getUI$))];
                addClass(subCauseUI, 'sub-cause');
                let ui = causeUI.concat(subCauseUI);
                ui.push(intersectionPoint.getUI$);
                ui = flatten(ui);
                console.log(ui);
                ui.forEach(el => {
                    el.parents().addClass(VisClasses.NON_FADE);
                    el.addClass(VisClasses.NON_FADE);
                });
            });
        };

        let addOverlay = function (ui, type, text, detailAction = () => {}) {
            console.log(ui);
            ui.toArray().forEach(u => {
                let id = $(u).data('element-id');
                if (id !== undefined) {
                    if (!(id in errorNodeMap)) errorNodeMap[id] = $('<div class="' + VisClasses.ERROR_CONTAINER + '"></div>');
                    let infoDiv = errorNodeMap[id];
                    let noteDiv = $('<div class="' + VisClasses.ANALYSIS_HINT + ' ' + type + '">' + text + '</div>');
                    infoDiv.append(noteDiv);
                    overlays.add(id, 'note', {
                        position: {
                            bottom: 5,
                            right: 5
                        },
                        html: infoDiv
                    });

                    let openerDiv = $('<div class="' + VisClasses.DETAIL_OPENER + ' ' + type + '">?</div>');
                    openerDiv.on('click', (ev) => {
                        openDetailPanel(detailAction);
                    });
                    noteDiv.append(openerDiv);
                    /*overlays.add(id, 'd-opener', {
                        position: {
                            top: -10,
                            left: -10
                        },
                        html: openerDiv
                    });*/
                }
            });
        };

        let openDetailPanel = function (action = () => {}) {
            let b = $('body');
            b.find('.' + VisClasses.DETAIL_PANEL).remove();
            fadeIn();
            let panel = b.append('<div class="' + VisClasses.DETAIL_PANEL + '"></div>');
            console.log(panel);

            action();
        }

        let fadeOut = function () {
            elementRegistry.getAll().forEach((el) => {
                $('[data-element-id="' + el.id + '"').addClass(VisClasses.HINT_FADE);
            });
        };
        let fadeIn = function () {
            elementRegistry.getAll().forEach((el) => {
                $('[data-element-id="' + el.id + '"').removeClass(VisClasses.HINT_FADE + ' ' + VisClasses.NON_FADE);
            });
        };
        let addClass = function (ui,clazz) {
            if (!Array.isArray(ui)) ui = [ ui ];
            ui.forEach(u => u.addClass(clazz));
        }
    }

    return (function () {
        return new VisualizerFactory();
    })();
});

export { Visualizer };