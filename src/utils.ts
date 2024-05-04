/**
 * Make an object or array recursively immutable.
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze.
 */
export function deepFreeze<T>(object: T): T
{
  // Retrieve the property names defined on object.
  const propNames = Reflect.ownKeys(object as any);

  // Freeze properties before freezing self.
  for (const name of propNames)
  {
    const value = (object as any)[name];

    if ((value && typeof value === 'object') || typeof value === 'function')
    {
      deepFreeze(value);
    }
  }

  return Object.freeze(object);
}