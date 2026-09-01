-- Stagepulse service pricing defaults requested for current live services
begin;
update public.services
set crew_min=case when name='SES SİSTEMİ' then 2 when name='Ses ışık truss kiralama' then 2 else crew_min end,
    crew_max=case when name='SES SİSTEMİ' then 4 when name='Ses ışık truss kiralama' then 6 else crew_max end,
    default_crew=case when name in ('SES SİSTEMİ','Ses ışık truss kiralama') then 3 else default_crew end,
    crew_unit_price=case when coalesce(crew_unit_price,0)=0 then 2500 else crew_unit_price end,
    setup_fee=case when coalesce(setup_fee,0)=0 then 2500 else setup_fee end,
    teardown_fee=case when coalesce(teardown_fee,0)=0 then 1500 else teardown_fee end,
    margin_pct=case when coalesce(margin_pct,0)=35 then 10 else margin_pct end
where name in ('SES SİSTEMİ','Ses ışık truss kiralama');
commit;