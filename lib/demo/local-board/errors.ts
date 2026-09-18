/**
 * Feiltypen hele den lokale demo-kjeden kaster.
 *
 * Den ligger i sin egen fil fordi både registeret (som ikke rører filsystemet)
 * og lasteren (som gjør det, og derfor er `server-only`) må kunne kaste den.
 * Uten det skillet ville et oppslag i registeret dratt med seg hele
 * filsystem-lasteren inn i hver modul som bare trenger å vite hvilke demoer
 * som finnes.
 */
export class LocalDatasetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalDatasetError";
  }
}
