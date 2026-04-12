export interface JetDeskMessage {
  v: number;
  type: string;
  seq: number;
  payload: any;
}

export function makeMessage(type: string, payload: any, seq = 0): JetDeskMessage {
  return { v: 1, type, payload, seq };
}
