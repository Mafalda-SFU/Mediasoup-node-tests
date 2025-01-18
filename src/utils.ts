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

export async function expect_rejects_toThrow(expression, errorMessage?: string): Promise<void>
{
  try
  {
    await expression;
  }
  catch (error)
  {
    if (!errorMessage || error.toString().includes(errorMessage)) return;

    throw error;
  }

  throw new Error('Expression did not throw');
}

export function expect_not_toThrow(fn: () => void, errorMessage?: string): void
{
  try
  {
    fn();
  }
  catch (error)
  {
    if(!errorMessage || error.toString().includes(errorMessage)) throw error;
  }
}

export function expect_toThrow(fn: () => void, errorMessage?: string): void
{
  try
  {
    fn();
  }
  catch (error)
  {
    if (!errorMessage || error.toString().includes(errorMessage)) return;

    console.log(error, error.name, error.toString(), errorMessage);
    throw error;
  }

  throw new Error('Function did not throw');
}