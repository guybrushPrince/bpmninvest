import $ from 'jquery';
import { faultBus, FaultType } from "./faultbus.mjs";
import { asList, union } from "./settools.mjs";
import { explanation as noStartExplanation } from '../explanations/no-start.mjs';
import { explanation as noEndExplanation } from '../explanations/no-end.mjs';
import { explanation as wrongGatewayExplanation } from "../explanations/wrong-gateway.mjs";
import { explanation as implicitStartExplanation } from '../explanations/implicit-start.mjs';
import { explanation as implicitEndExplanation } from '../explanations/implicit-end.mjs';
import { explanation as loopExitNotXORExplanation } from '../explanations/loop-exit-not-xor.mjs';
import { explanation as loopEntryIsANDExplanation } from "../explanations/loop-entry-is-and.mjs";
import { explanation as deadlockExplanation } from '../explanations/deadlocks.mjs';
import { explanation as lackOfSynchronizationExplanation } from '../explanations/lack-of-synchronization.mjs';
import { explanation as endlessLoopExplanation } from '../explanations/endless-loop.mjs';
import { explanation as backJoinExplanation } from '../explanations/back-join-is-and.mjs';
import { explanation as liveLockExplanation } from '../explanations/live-lock.mjs';
import { explanation as deadLoopExplanation } from '../explanations/dead-loop.mjs';
import { PathFinderFactory } from "./pathfinder.mjs";
import { flatten } from "array-flatten";

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

    HIGHLIGHT: 'highlight'
};

// Texts being displayed in the editor.
const Texts = {
    NO_START: 'No explicit or implicit start event',
    NO_END: 'No explicit or implicit end event',
    IMPLICIT_START: 'Implicit start event',
    IMPLICIT_END: 'Implicit end event',
    GATEWAY_WITHOUT_MULTIPLE_FLOWS: 'Wrongly structured gateway',
    LOOP_EXIT_NOT_XOR: 'Wrong loop exit',
    LOOP_ENTRY_IS_AND: 'Wrong loop entry',
    LOOP_BACK_JOIN_IS_AND: 'Possible deadlock',
    POTENTIAL_DEADLOCK: 'Possible deadlock',
    POTENTIAL_LACK_OF_SYNCHRONIZATION: 'Possible missing synchronization',
    POTENTIAL_ENDLESS_LOOP: 'Possible endless loop',
    LIVE_LOCK: 'Endless loop',
    DEAD_LOOP: 'Dead loop'
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
            setAnalysisPanel([], [
                'safeness',
                'optionToComplete',
                'properCompletion',
                'noDeadActivities',
                'bestPractices'
            ]);
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
                    visualizeBackJoinIsAnd(type, elements, process);
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
                case FaultType.LIVE_LOCK: {
                    visualizeLiveLock(type, elements, process);
                } break;
                case FaultType.DEAD_LOOP: {
                    visualizeDeadLoop(type, elements, process);
                } break;
            }
            informAnalysisPanel(fault);
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

        let visualizeDefectGateway = function (type, information) {
            let element = information.gateway;
            let ui = element.getUI$;
            addClass(ui, [VisClasses.VISUALIZED_LINE, VisClasses.WARNING_LINE]);
            addOverlay(element.getUI$, type, Texts.GATEWAY_WITHOUT_MULTIPLE_FLOWS, (panel) => {
                fadeOut();
                addClass(ui, VisClasses.NON_FADE, true);

                wrongGatewayExplanation(panel, information, modelerInstance);
            });
        };

        let visualizeLoopEntryIsAnd = function (type, elements, process) {
            let loopEntry = elements.entry;
            let loop = elements.loop;
            let into = union(elements.into, {});
            into[loopEntry.getId] = loopEntry;
            loop.getEdges;
            addClass(loopEntry.getUI$, [VisClasses.VISUALIZED_LINE, VisClasses.ERROR_LINE]);
            let closerAction = () => {};
            addOverlay(loopEntry.getUI$, type, Texts.LOOP_ENTRY_IS_AND, (panel) => {
                fadeOut();
                addClass(mapToUI(union(loop.getNodes, loop.getEdges)), VisClasses.NON_FADE, true);
                addClass(mapModelToBPMNUI(into), [ VisClasses.VISUALIZED_LINE, VisClasses.PULSATING_LINE,
                    VisClasses.NON_FADE], VisClasses.NON_FADE);
                addClass(loopEntry.getUI$, VisClasses.NON_FADE, true);

                closerAction = loopEntryIsANDExplanation(panel, elements, modelerInstance, process);
            }, () => { closerAction(); });
        };

        let visualizeLoopExitNotXor = function (type, elements, process) {
            let loopExit = elements.exit;
            let loop = elements.loop;
            let out = union(elements.out, {});
            out[loopExit.getId] = loopExit;
            loop.getEdges;
            addClass(loopExit.getUI$, [ VisClasses.VISUALIZED_LINE, VisClasses.ERROR_LINE ]);
            let closerAction = () => {};
            addOverlay(loopExit.getUI$, type, Texts.LOOP_EXIT_NOT_XOR, (panel) => {
                fadeOut();

                addClass(mapModelToBPMNUI(union(loop.getNodes, loop.getEdges)), VisClasses.NON_FADE, true);
                addClass(mapModelToBPMNUI(out), [ VisClasses.VISUALIZED_LINE, VisClasses.PULSATING_LINE,
                    VisClasses.NON_FADE], VisClasses.NON_FADE);
                addClass(loopExit.getUI$, VisClasses.NON_FADE, true);

                closerAction = loopExitNotXORExplanation(panel, elements, modelerInstance, process);
            }, () => { closerAction(); });
        };

        let visualizeBackJoinIsAnd = function (type, elements, process) {
            let backJoin = elements.backJoin;
            addClass(backJoin.getUI$, [VisClasses.VISUALIZED_LINE, VisClasses.ERROR_LINE]);
            let closerAction = () => {};
            addOverlay(backJoin.getUI$, type, Texts.LOOP_BACK_JOIN_IS_AND, (panel) => {
                fadeOut();
                let flawsUI = mapModelToBPMNUI(elements.flaws);
                addClass(flawsUI, [VisClasses.VISUALIZED_LINE, VisClasses.PULSATING_LINE, VisClasses.NON_FADE],
                    VisClasses.NON_FADE);
                addClass(mapModelToBPMNUI(elements.doBody), VisClasses.NON_FADE, true);

                closerAction = backJoinExplanation(panel, elements, modelerInstance);
            }, () => { closerAction(); });
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
            let closerAction = () => {};
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

                closerAction = endlessLoopExplanation(panel, elements, modelerInstance);
            }, () => { closerAction(); });
        };

        let visualizeLiveLock = function (type, elements, process) {
            let loopModel = elements.loop;
            let entry = elements.refEntry;
            addClass(entry.getUI$, [VisClasses.VISUALIZED_LINE, VisClasses.ERROR_LINE]);
            let closerAction = () => {};
            addOverlay(entry.getUI$, type, Texts.LIVE_LOCK, (panel) => {
                fadeOut();
                let causeUI = entry.getUI$;
                addClass(causeUI, [VisClasses.VISUALIZED_LINE, VisClasses.PULSATING_LINE, VisClasses.NON_FADE],
                    VisClasses.NON_FADE);
                addClass(mapToUI(union(loopModel.getNodes, loopModel.getEdges)), VisClasses.NON_FADE, true);

                closerAction = liveLockExplanation(panel, elements, modelerInstance);
            }, () => { closerAction(); });
        };

        let visualizeDeadLoop = function (type, elements, process) {
            let loopModel = elements.loop;
            let loop = mapToUI(union(loopModel.getNodes, loopModel.getEdges));
            addClass(loop, [VisClasses.VISUALIZED_LINE, VisClasses.ERROR_LINE]);
            let representative = asList(loopModel.getNodes)[0];
            addOverlay(representative.getUI$, type, Texts.DEAD_LOOP, (panel) => {
                fadeOut();
                addClass(loop, [VisClasses.VISUALIZED_LINE, VisClasses.PULSATING_LINE, VisClasses.NON_FADE],
                    VisClasses.NON_FADE);

                deadLoopExplanation(panel, elements, modelerInstance);
            }, () => { });
        };

        let addOverlay = function (ui, type, text, detailAction = () => {}, detailClose = () => {}, show = false) {
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
            let closer = $('<button id="close-panel" title="Close explanation">x</button>');
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
        let informAnalysisPanel = function(type) {
            switch (type) {
                case FaultType.NO_START:
                case FaultType.NO_END: {
                    setAnalysisPanel([
                        'optionToComplete',
                        'properCompletion',
                        'noDeadActivities',
                        'bestPractices'
                    ]);
                } break;
                case FaultType.IMPLICIT_START:
                case FaultType.IMPLICIT_END:
                case FaultType.GATEWAY_WITHOUT_MULTIPLE_FLOWS: {
                    setAnalysisPanel([
                        'bestPractices'
                    ]);
                } break;
                case FaultType.LOOP_EXIT_NOT_XOR: {
                    setAnalysisPanel([
                        'safeness',
                        'properCompletion',
                        'bestPractices'
                    ]);
                } break;
                case FaultType.LOOP_ENTRY_IS_AND: {
                    setAnalysisPanel([
                        'optionToComplete',
                        'properCompletion',
                        'noDeadActivities',
                        'bestPractices'
                    ]);
                } break;
                case FaultType.LOOP_BACK_JOIN_IS_AND: {
                    setAnalysisPanel([
                        'optionToComplete',
                        'properCompletion',
                        'noDeadActivities'
                    ]);
                } break;
                case FaultType.POTENTIAL_DEADLOCK: {
                    setAnalysisPanel([
                        'optionToComplete',
                        'properCompletion',
                        'noDeadActivities'
                    ]);
                } break;
                case FaultType.POTENTIAL_LACK_OF_SYNCHRONIZATION:
                case FaultType.POTENTIAL_ENDLESS_LOOP: {
                    setAnalysisPanel([
                        'safeness',
                        'properCompletion'
                    ]);
                } break;
                case FaultType.LIVE_LOCK: {
                    setAnalysisPanel([
                        'properCompletion',
                        'optionToComplete',
                        'bestPractices'
                    ]);
                } break;
                case FaultType.DEAD_LOOP: {
                    setAnalysisPanel([
                        'noDeadActivities',
                        'bestPractices'
                    ]);
                } break;
            }
        };
        let setAnalysisPanel = function (violated, fulfilled = []) {
            let safeness = $('#Safeness, #Safeness-icon');
            let optionToComplete = $('#OptionToComplete, #OptionToComplete-icon');
            let properCompletion = $('#ProperCompletion, #ProperCompletion-icon');
            let noDeadActivities = $('#NoDeadActivities, #NoDeadActivities-icon');
            let bestPractices = $('#BestPractices, #BestPractices-icon');

            if (violated.includes('safeness')) {
                safeness.removeClass('fulfilled icon-check');
                safeness.addClass('violated icon-xmark');
            }
            if (violated.includes('optionToComplete')) {
                optionToComplete.removeClass('fulfilled icon-check');
                optionToComplete.addClass('violated icon-xmark');
            }
            if (violated.includes('properCompletion')) {
                properCompletion.removeClass('fulfilled icon-check');
                properCompletion.addClass('violated icon-xmark');
            }
            if (violated.includes('noDeadActivities')) {
                noDeadActivities.removeClass('fulfilled icon-check');
                noDeadActivities.addClass('violated icon-xmark');
            }
            if (violated.includes('bestPractices')) {
                bestPractices.removeClass('fulfilled icon-check');
                bestPractices.addClass('violated icon-xmark');
            }

            if (fulfilled.includes('safeness')) {
                safeness.addClass('fulfilled icon-check');
                safeness.removeClass('violated icon-xmark');
            }
            if (fulfilled.includes('optionToComplete')) {
                optionToComplete.addClass('fulfilled icon-check');
                optionToComplete.removeClass('violated icon-xmark');
            }
            if (fulfilled.includes('properCompletion')) {
                properCompletion.addClass('fulfilled icon-check');
                properCompletion.removeClass('violated icon-xmark');
            }
            if (fulfilled.includes('noDeadActivities')) {
                noDeadActivities.addClass('fulfilled icon-check');
                noDeadActivities.removeClass('violated icon-xmark');
            }
            if (fulfilled.includes('bestPractices')) {
                bestPractices.addClass('fulfilled icon-check');
                bestPractices.removeClass('violated icon-xmark');
            }
        };
        let mapToUI = function (set) {
            return [...new Set(asList(set).map(s => s.getUI$))];
        };
        let mapModelToBPMNUI = function (set) {
            let uis = PathFinderFactory(modelerInstance).mapNodeSetToBPMN(set).map(b => $('[data-element-id="' + b.id + '"]'));
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