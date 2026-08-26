import { NextFunction, Request, RequestHandler, Response } from "express";

/** Envolve um handler assíncrono para que rejeições de Promise cheguem ao middleware de erro do Express. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
