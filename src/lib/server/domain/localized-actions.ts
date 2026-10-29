import {
  error,
  fail,
  isActionFailure,
  isHttpError,
  type Actions,
  type RequestEvent,
} from "@sveltejs/kit";
import { actionMessage } from "$lib/i18n/action-messages";
import type { Locale } from "$lib/i18n";

/** Keep locale at the presentation boundary; domain records/statuses stay unchanged. */
export function localizedActions<T extends Actions>(
  actions: T,
  translateMessage: (locale: Locale, message: string) => string = actionMessage,
): T {
  return Object.fromEntries(
    Object.entries(actions).map(([name, action]) => [
      name,
      async (event: RequestEvent) => {
        try {
          const result: unknown = await action(event);
          if (isActionFailure(result)) {
            // Kit's predicate defaults ActionFailure's data type to undefined;
            // validate the runtime envelope before reading a message payload.
            const failureData = (result as { data: unknown }).data;
            if (
              failureData &&
              typeof failureData === "object" &&
              "message" in failureData &&
              typeof failureData.message === "string"
            ) {
              return fail(result.status, {
                ...failureData,
                message: translateMessage(
                  event.locals.locale,
                  failureData.message,
                ),
              });
            }
          }
          if (
            result &&
            typeof result === "object" &&
            "message" in result &&
            typeof result.message === "string"
          ) {
            return {
              ...result,
              message: translateMessage(event.locals.locale, result.message),
            };
          }
          return result;
        } catch (cause) {
          if (isHttpError(cause))
            error(cause.status, {
              ...cause.body,
              message: translateMessage(
                event.locals.locale,
                cause.body.message,
              ),
            });
          throw cause;
        }
      },
    ]),
  ) as unknown as T;
}
