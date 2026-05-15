import { Router, Request, Response } from "express";
import { contractRegistry } from "../contracts/registry";

export const contractsRoutes = Router();

// GET /api/contracts — list all loaded contract definitions
contractsRoutes.get("/", (_req: Request, res: Response) => {
    const names = contractRegistry.list();
    const contracts = names.map((name) => {
        const contract = contractRegistry.get(name)!;
        return {
            name: contract.name,
            version: contract.version,
            module: contract.module,
            description: contract.description,
            field_count: Object.keys(contract.fields).length,
            semantic_checks: contract.semantic_checks?.length ?? 0,
        };
    });
    res.json({ contracts, total: contracts.length });
});

// GET /api/contracts/:id — get specific contract definition by name
contractsRoutes.get("/:id", (req: Request, res: Response) => {
    const contract = contractRegistry.get(String(req.params.id));
    if (!contract) {
        res.status(404).json({ error: `Contract not found: ${String(req.params.id)}` });
        return;
    }
    res.json(contract);
});
