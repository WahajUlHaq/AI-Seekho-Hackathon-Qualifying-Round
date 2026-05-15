import { Router, Request, Response } from "express";
import { contractRegistry } from "../contracts/registry";

export const contractsRoutes = Router();

// GET /api/contracts — list all loaded contracts (summary)
contractsRoutes.get("/", (_req: Request, res: Response) => {
    const names = contractRegistry.list();
    const contracts = names.map((name) => {
        const c = contractRegistry.getRequired(name);
        return {
            name: c.name,
            version: c.version,
            module: c.module,
            description: c.description,
            field_count: Object.keys(c.fields).length,
        };
    });
    res.json({ contracts });
});

// GET /api/contracts/:name — full contract definition
contractsRoutes.get("/:name", (req: Request, res: Response) => {
    const contract = contractRegistry.get(req.params.name as string);
    if (!contract) {
        res.status(404).json({ error: `Contract not found: ${req.params.name as string}` });
        return;
    }
    res.json(contract);
});
