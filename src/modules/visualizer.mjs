import $ from 'jquery';
import { faultBus, FaultType } from "./faultbus.mjs";
import { asList, union } from "./settools.mjs";
import { explanation as noStartExplanation } from '../explanations/no-start.mjs';
import { explanation as noEndExplanation } from '../explanations/no-end.mjs';
import { explanation as implicitStartExplanation } from '../explanations/implicit-start.mjs';
import { explanation as implicitEndExplanation } from '../explanations/implicit-end.mjs';
import { explanation as loopExitNotXORExplanation } from '../explanations/loop-exit-not-xor.mjs';
import { explanation as loopEntryIsANDExplanation } from "../explanations/loop-entry-is-and.mjs";
import { explanation as deadlockExplanation } from '../explanations/deadlocks.mjs';
import { explanation as lackOfSynchronizationExplanation } from '../explanations/lack-of-synchronization.mjs';
import { explanation as endlessLoopExplanation } from '../explanations/endless-loop.mjs';
import { PathFinderFactory } from "./pathfinder.mjs";
import { flatten } from "array-flatten";

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

    HIGHLIGHT: 'highlight'
};

const Texts = {
    NO_START: 'No explicit or implicit start event',
    NO_END: 'No explicit or implicit end event',
    IMPLICIT_START: 'Implicit start event',
    IMPLICIT_END: 'Implicit end event',
    GATEWAY_WITHOUT_MULTIPLE_FLOWS: 'The gateway has neither multiple incoming nor multiple outgoing flows',
    LOOP_EXIT_NOT_XOR: 'Wrong loop exit',
    LOOP_ENTRY_IS_AND: 'Wrong loop entry',
    LOOP_BACK_JOIN_IS_AND: 'Possible deadlock',
    POTENTIAL_DEADLOCK: 'Possible deadlock',
    POTENTIAL_LACK_OF_SYNCHRONIZATION: 'Possible missing synchronization',
    POTENTIAL_ENDLESS_LOOP: 'Possible endless loop'
};

const Visualizer = (function () {

    function VisualizerFactory() {

        let overlays;
        let elementRegistry;
        let modelerInstance;

        let errorNodeMap = {};

        this.initialize = function (modeler, faultBus) {
            modelerInstance = modeler;
            overlays = modeler.get('overlays');
            elementRegistry = modeler.get('elementRegistry')
            faultBus.subscribe(this);
        }
        this.destruct = function () {
            faultBus.unsubscribe(this);
            elementRegistry.getAll().forEach((el) => {
                $('[data-element-id="' + el.id + '"').removeClass(asList(VisClasses).join(' '));
            });
            overlays.clear();
        }

        this.notify = function (type, process, elements, fault) {
            enhanceModel(type, process, elements, fault);
        }

        let enhanceModel = function (type, process, elements, fault) {
            switch (fault) {
                case FaultType.NO_START: {
                    visualizeNoStart(type, process);
                } break;
                case FaultType.NO_END: {
                    visualizeNoEnd(type, process);
                } break;
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
                    visualizeLoopExitNotXor(type, elements, process);
                } break;
                case FaultType.LOOP_ENTRY_IS_AND: {
                    visualizeLoopEntryIsAnd(type, elements, process);
                } break;
                case FaultType.LOOP_BACK_JOIN_IS_AND: {
                    visualizeBackJoinIsAnd(type, elements);
                } break;
                case FaultType.POTENTIAL_DEADLOCK: {
                    visualizeDeadlock(type, elements);
                } break;
                case FaultType.POTENTIAL_LACK_OF_SYNCHRONIZATION: {
                    visualizeLackOfSynchronization(type, elements, process);
                } break;
                case FaultType.POTENTIAL_ENDLESS_LOOP: {
                    visualizePotentialEndlessLoop(type, elements, process);
                } break;
            }
        };

        let visualizeNoStart = function (type, process) {
            let ui = $(process.getUI$[0]);
            addClass(ui, [VisClasses.VISUALIZED_LINE, VisClasses.ERROR_LINE]);
            addOverlay(ui, type, Texts.NO_START, (panel) => {
                fadeOut();
                addClass(ui, VisClasses.NON_FADE, true);
                noStartExplanation(panel);
            }, () => {}, true);
        };

        let visualizeNoEnd = function (type, process) {
            let ui = $(process.getUI$[0]);
            addClass(ui, [VisClasses.VISUALIZED_LINE, VisClasses.ERROR_LINE]);
            addOverlay(ui, type, Texts.NO_END, (panel) => {
                fadeOut();
                addClass(ui, VisClasses.NON_FADE, true);
                noEndExplanation(panel);
            }, () => {}, true);
        };

        let visualizeImplicitStart = function (type, elements) {
            elements.implicitStart.forEach(el => {
                let ui = el.getUI$;
                addClass(ui, [VisClasses.VISUALIZED_LINE, VisClasses.INFO_LINE]);
                let closerAction = () => {};
                addOverlay(ui, type, Texts.IMPLICIT_START, (panel) => {
                    fadeOut();
                    addClass(ui, VisClasses.NON_FADE, true);

                    closerAction = implicitStartExplanation(panel, elements, modelerInstance);
                }, () => { closerAction(); });
            });
        };

        let visualizeImplicitEnd = function (type, elements) {
            elements.implicitEnd.forEach(el => {
                let ui = el.getUI$;
                addClass(ui, [VisClasses.VISUALIZED_LINE, VisClasses.INFO_LINE]);
                let closerAction = () => {};
                addOverlay(el.getUI$, type, Texts.IMPLICIT_END, (panel) => {
                    fadeOut();
                    addClass(ui, VisClasses.NON_FADE, true);

                    closerAction = implicitEndExplanation(panel, elements, modelerInstance);
                }, () => { closerAction(); });
            });
        };

        let visualizeDefectGateway = function (type, element) {
            let ui = element.getUI$;
            addClass(ui, [VisClasses.VISUALIZED_LINE, VisClasses.WARNING_LINE]);
            addOverlay(element.getUI$, type, Texts.GATEWAY_WITHOUT_MULTIPLE_FLOWS, () => {
                fadeOut();
                addClass(ui, VisClasses.NON_FADE, true);
            });
        };

        let visualizeLoopEntryIsAnd = function (type, elements, process) {
            let loopEntry = elements.entry;
            let loop = elements.loop;
            loop.getEdges;
            addClass(loopEntry.getUI$, [VisClasses.VISUALIZED_LINE, VisClasses.ERROR_LINE]);
            addOverlay(loopEntry.getUI$, type, Texts.LOOP_ENTRY_IS_AND, (panel) => {
                fadeOut();
                addClass(mapToUI(union(loop.getNodes, loop.getEdges)), VisClasses.NON_FADE, true);
                addClass(loopEntry.getUI$, VisClasses.NON_FADE, true);

                loopEntryIsANDExplanation(panel, elements, modelerInstance, process);
            });
        };

        let visualizeLoopExitNotXor = function (type, elements, process) {
            let loopExit = elements.exit;
            let loop = elements.loop;
            let out = elements.out;
            out[loopExit.getId] = loopExit;
            loop.getEdges;
            addClass(loopExit.getUI$, [ VisClasses.VISUALIZED_LINE, VisClasses.ERROR_LINE ]);
            addOverlay(loopExit.getUI$, type, Texts.LOOP_EXIT_NOT_XOR, (panel) => {
                fadeOut();

                addClass(mapModelToBPMNUI(union(loop.getNodes, loop.getEdges)), VisClasses.NON_FADE, true);
                addClass(mapModelToBPMNUI(out), [ VisClasses.VISUALIZED_LINE, VisClasses.PULSATING_LINE,
                    VisClasses.NON_FADE], VisClasses.NON_FADE);
                addClass(loopExit.getUI$, VisClasses.NON_FADE, true);

                loopExitNotXORExplanation(panel, elements, modelerInstance, process);
            });
        };

        let visualizeBackJoinIsAnd = function (type, elements) {
            let backJoin = elements.backJoin;
            addClass(backJoin.getUI$, [VisClasses.VISUALIZED_LINE, VisClasses.ERROR_LINE]);
            addOverlay(backJoin.getUI$, type, Texts.LOOP_BACK_JOIN_IS_AND, () => {
                fadeOut();
                let flawsUI = mapToUI(elements.flaws);
                addClass(flawsUI, [VisClasses.VISUALIZED_LINE, VisClasses.PULSATING_LINE, VisClasses.NON_FADE],
                    VisClasses.NON_FADE);
                let ui = mapToUI(elements.paths);
                addClass(ui, VisClasses.NON_FADE, true);
            });
        };

        let visualizeDeadlock = function (type, elements) {
            let join = elements.join;
            let paths = elements.paths;
            addClass(join.getUI$, [VisClasses.VISUALIZED_LINE, VisClasses.ERROR_LINE]);
            let closerAction = () => {};
            addOverlay(join.getUI$, type, Texts.POTENTIAL_DEADLOCK, (panel) => {
                fadeOut();
                if (asList(elements.flaws).length > 0) {
                    asList(elements.flaws).forEach((flaws) => {
                        let flawsUI = mapModelToBPMNUI(flaws);
                        addClass(flawsUI, [VisClasses.VISUALIZED_LINE, VisClasses.PULSATING_LINE,
                            VisClasses.NON_FADE], VisClasses.NON_FADE);
                    });
                }
                let pathsUI = flatten(asList(paths).map(p => mapModelToBPMNUI(p)));
                addClass(pathsUI, VisClasses.NON_FADE, true);

                closerAction = deadlockExplanation(panel, elements, modelerInstance);
            }, () => { closerAction(); });
        };

        let visualizeLackOfSynchronization = function (type, elements, process) {
            let intersectionPoint = elements.intersectionPoint;
            addClass(intersectionPoint.getUI$, [VisClasses.VISUALIZED_LINE, VisClasses.ERROR_LINE]);
            let closerAction = () => {};
            addOverlay(intersectionPoint.getUI$, type, Texts.POTENTIAL_LACK_OF_SYNCHRONIZATION, (panel) => {
                let split = elements.split;
                let postset = elements.postset;
                let paths = elements.paths;
                fadeOut();
                let causeUI = split.getUI$;
                addClass(causeUI, [VisClasses.VISUALIZED_LINE, VisClasses.PULSATING_LINE, VisClasses.NON_FADE],
                    VisClasses.NON_FADE);
                let extendedPostset = union({}, postset);
                extendedPostset[split.getId] = split;
                let subCauseUI = mapModelToBPMNUI(extendedPostset);
                addClass(subCauseUI, [VisClasses.VISUALIZED_LINE, VisClasses.PULSATING_LINE, VisClasses.NON_FADE],
                    VisClasses.NON_FADE);
                addClass(intersectionPoint.getUI$, VisClasses.NON_FADE, true);
                asList(paths).forEach(path => {
                    addClass(mapModelToBPMNUI(path), VisClasses.NON_FADE, true);
                });

                closerAction = lackOfSynchronizationExplanation(panel, elements, modelerInstance);
            }, () => { closerAction(); });
        };

        let visualizePotentialEndlessLoop = function (type, elements, process) {
            let intersectionPoint = elements.intersectionPoint;
            let split = elements.split;
            let postset = elements.postset;
            addClass(split.getUI$, [VisClasses.VISUALIZED_LINE, VisClasses.ERROR_LINE]);
            addOverlay(split.getUI$, type, Texts.POTENTIAL_ENDLESS_LOOP, (panel) => {
                fadeOut();
                let causeUI = intersectionPoint.getUI$;
                addClass(causeUI, [VisClasses.VISUALIZED_LINE, VisClasses.PULSATING_LINE, VisClasses.NON_FADE],
                    VisClasses.NON_FADE);
                let subCauseUI = mapToUI(postset);
                addClass(subCauseUI, [VisClasses.VISUALIZED_LINE, VisClasses.PULSATING_LINE, VisClasses.NON_FADE],
                    VisClasses.NON_FADE);
                addClass(split.getUI$, VisClasses.NON_FADE, true);
                addClass(mapToUI(union(process.getNodes, process.getEdges)), VisClasses.NON_FADE, true);

                endlessLoopExplanation(panel, elements, modelerInstance);
            });
        };

        let addOverlay = function (ui, type, text, detailAction = () => {}, detailClose = () => {}, show = false) {
            console.log(ui);
            ui.toArray().forEach(u => {
                let id = $(u).data('element-id');
                if (id !== undefined) {
                    if (!(id in errorNodeMap)) errorNodeMap[id] = $('<div class="' + VisClasses.ERROR_CONTAINER + '"></div>');
                    let infoDiv = errorNodeMap[id];
                    let cl = show ? VisClasses.ANALYSIS_HINT_VISIBLE : VisClasses.ANALYSIS_HINT;
                    let noteDiv = $('<div class="' + cl + ' ' + type + '"><div>' + text + '</div></div>');
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
                        openDetailPanel(detailAction, detailClose);
                    });
                    noteDiv.append(openerDiv);
                }
            });
        };

        let openDetailPanel = function (action = () => {}, close = () => {}) {
            let b = $('body');
            b.find('.' + VisClasses.DETAIL_PANEL).remove();
            fadeIn();
            let panel = $('<div class="' + VisClasses.DETAIL_PANEL + '"></div>');
            b.append(panel);
            let closer = $('<button id="close-panel">x</button>');
            panel.append(closer);
            closer.on('click', function () {
                panel.remove();
                fadeIn();
                close();
            });

            action(panel);
            panel.find('a[data-element-link]').on('mouseover', function () {
                let link = $(this).data('element-link');
                if (link !== null && link !== undefined) {
                    let sel = link.map(l => '[data-element-id="' + l + '"]').join(',');
                    console.log(sel);
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

        let fadeOut = function () {
            elementRegistry.getAll().forEach((el) => {
                $('[data-element-id="' + el.id + '"').addClass(VisClasses.HINT_FADE);
            });
        };
        let fadeIn = function () {
            elementRegistry.getAll().forEach((el) => {
                $('[data-element-id="' + el.id + '"').removeClass([
                    VisClasses.HINT_FADE,
                    VisClasses.NON_FADE,
                    VisClasses.PULSATING_LINE
                ].join(' '));
            });
        };
        let mapToUI = function (set) {
            return [...new Set(asList(set).map(s => s.getUI$))];
        };
        let mapModelToBPMNUI = function (set) {
            let uis = PathFinderFactory(modelerInstance).mapNodeSetToBPMN(set).map(b => $('[data-element-id="' + b.id + '"]'));
            console.log('UIs', uis);
            return uis;
        };
        let addClass = function (ui, clazz, withParents = false) {
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
    }

    return (function () {
        return new VisualizerFactory();
    })();
});

export { Visualizer };