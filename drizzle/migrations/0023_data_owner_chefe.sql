CREATE OR REPLACE FUNCTION public.data_owner()
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.team_members WHERE lower(email)=lower(coalesce(auth.jwt()->>'email','')) AND papel IN ('vendedor','tecnico','chefe_oficina')) THEN NULL
    ELSE coalesce((SELECT owner_id FROM public.team_members WHERE lower(email) = lower(coalesce(auth.jwt()->>'email','')) LIMIT 1), auth.uid())
  END
$function$;