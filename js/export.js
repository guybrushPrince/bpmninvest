let extractDiagram = function (diagram, index) {
    // The diagram model.
    let m = new BPMNModel(diagram.id);

    let nodes = {};
    let edges = {};

    let getOrCreateNode = function (id, type) {
        if (!(id in nodes)) {
            if (id.startsWith('Activity')) nodes[id] = new Task(id, type);
            else if (id.startsWith('Start')) nodes[id] = new Start(id, type);
            else if (id.startsWith('End')) nodes[id] = new End(id, type);
            else if (id.startsWith('Gateway')) nodes[id] = new Gateway(id, type);
        }
        return nodes[id];
    };
    let getOrCreateDetailedNode = function (node) {
        return getOrCreateNode(node.id, node.$type);
    };
    let getOrCreateEdge = function (flow) {
        let id = flow.id;
        if (!(id in edges)) {
            edges[id] = new Edge(id,
                getOrCreateNode(flow.sourceRef.id, flow.sourceRef.$type),
                getOrCreateNode(flow.targetRef.id, flow.targetRef.$type)
            );
        }
        return edges[id];
    };

    let findElements = function (p, elements) {
        elements.forEach(function (el) {
            let id = el.id;
            if (id.startsWith('Flow')) {
                p.addEdge(getOrCreateEdge(el));
            } else { // It is a node
                p.addNode(getOrCreateDetailedNode(el));
            }
        });
    };

    if ('plane' in diagram) {
        let plane = diagram.plane;
        if ('bpmnElement' in plane) {
            let container = plane.bpmnElement;
            if ('messageFlows' in container && Array.isArray(container.messageFlows)) {
                m.setMessages(container.messageFlows.map(function (flow) {
                    return new MessageFlow(flow.id,
                        getOrCreateNode(flow.sourceRef.id, flow.sourceRef.$type),
                        getOrCreateNode(flow.targetRef.id, flow.targetRef.$type)
                    );
                }));
            }
            if ('participants' in container && Array.isArray(container.participants)) {
                m.setProcesses(container.participants.map(function (process) {
                    let p = new Process(process.id);
                    findElements(p, process.processRef.flowElements);
                    p.computeInOut();
                    return p;
                }));
            }
        } else if ('planeElement' in plane) {

        }
    }
    return m;
};

if (typeof bpmnio !== 'undefined') {
    if ('modeler' in bpmnio) {
        let modeler = bpmnio.modeler;
        if ('_definitions' in modeler) {
            let definitions = modeler._definitions;
            if ('diagrams' in definitions) {
                let diagrams = definitions.diagrams;
                if (Array.isArray(diagrams)) {
                    let exp = diagrams.map(extractDiagram);
                    console.log(exp);
                }
            }
        }
    }
}