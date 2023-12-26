import middy from '@middy/core';

export const getOrgIdFromContext = (event: middy.Request['event']) => {
  try {
    return (
      // check authorizer first
      event?.requestContext?.authorizer?.lambda?.organizationId ||
      // check context next
      Object.entries(event?.headers ?? {}).find(([header, _]) => header.toLowerCase() === 'x-ivy-org-id')?.[1] ||
      Object.entries(event?.headers ?? {}).find(([header, _]) => header.toLowerCase() === 'x-epilot-org-id')?.[1]
    );
  } catch (e) {
    console.warn('Failed to get orgId from context', e, event);

    return null;
  }
};
