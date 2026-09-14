/** Keep map acknowledgement behind the camera animation and marker render. */
export async function revealAfterCamera<T>(options: {
  frame: () => void;
  reveal: () => T;
  current: () => boolean;
  painted: () => Promise<void>;
  wait: (ms: number) => Promise<void>;
}): Promise<T | null> {
  await options.painted();
  if (!options.current()) return null;
  options.frame();
  await options.wait(1500); // camera duration is 1400ms
  if (!options.current()) return null;
  const result = options.reveal();
  await options.painted();
  return options.current() ? result : null;
}
