using Microsoft.Data.Sqlite;

namespace DndForum.Api;

internal static class ApiExceptionHandling
{
    internal static async Task Invoke(HttpContext context, RequestDelegate next)
    {
        try
        {
            await next(context);
        }
        catch (BadHttpRequestException) when (!context.Response.HasStarted)
        {
            await ApiSupport.BadRequest("invalid_request")
                .ExecuteAsync(context);
        }
        catch (SqliteException exception)
            when (exception.SqliteErrorCode == 19 && !context.Response.HasStarted)
        {
            await ApiSupport.ConstraintError(exception)
                .ExecuteAsync(context);
        }
    }
}
