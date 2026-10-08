ALTER TABLE public.mech_month ADD COLUMN IF NOT EXISTS grupo text NOT NULL DEFAULT 'outros';

UPDATE public.mech_month SET grupo = 'moto'
 WHERE upper(translate(lower(nome), 'áàâãéêíóôõúç', 'aaaaeeiooouc')) IN
  ('INOCENCIO RIBEIRO NETO','JAIR ALVES DOS ANJOS','JOAO PAULO','MATHEUS FELIX DA SILVA');

UPDATE public.mech_month SET grupo = 'carro'
 WHERE upper(translate(lower(nome), 'áàâãéêíóôõúç', 'aaaaeeiooouc')) IN
  ('FLAVIO PINHEIRO','DELMIR','JONATAS MORAES','LUIS SANDRO','MATHEUS DA PAZ','ORLANDO','SERGIO CARVALHO','VICTOR FILIPE SILVA ROCHA','VINICIUS','WELLINGTON DA SILVA TELES','WELLIGTON DA SILVA TELES');

ALTER TABLE public.mech_month ADD CONSTRAINT mech_month_grupo_chk CHECK (grupo IN ('carro','moto','outros'));