-- Professional AV taxonomy. Additive seed data only.
with classes as (
  select id,name from public.equipment_classes
), seeds as (
  select 'Audio' class_name,'PA / Main System' name,'Main loudspeakers, point source and line-array systems' description,10 sort_order union all
  select 'Audio','Subwoofer','Subwoofer systems',20 union all
  select 'Audio','Stage Monitor','Wedge and stage monitor systems',30 union all
  select 'Audio','Mixing Console','FOH and monitor mixing consoles',40 union all
  select 'Audio','Digital Stagebox','Digital stageboxes and I/O',50 union all
  select 'Audio','Analog I/O','Analog inputs, outputs and patch systems',60 union all
  select 'Audio','Wireless','Wireless microphones and receivers',70 union all
  select 'Audio','Microphone','Wired microphones',80 union all
  select 'Audio','DI / Interface','DI boxes and audio interfaces',90 union all
  select 'Audio','DSP / Processor','System processors and DSP',100 union all
  select 'Lighting','Moving Head','Moving head fixtures',10 union all
  select 'Lighting','Wash','Wash fixtures',20 union all
  select 'Lighting','Beam','Beam fixtures',30 union all
  select 'Lighting','Profile','Profile / spot fixtures',40 union all
  select 'Lighting','LED','LED battens, panels and decorative fixtures',50 union all
  select 'Lighting','Control Console','Lighting control desks and controllers',60 union all
  select 'Lighting','DMX / Network','DMX and lighting network infrastructure',70 union all
  select 'Video','LED Wall','LED display modules and cabinets',10 union all
  select 'Video','Processor','LED/video processors',20 union all
  select 'Video','Switcher','Video switchers and routing',30 union all
  select 'Video','Playback','Playback computers and media servers',40 union all
  select 'Video','Projector','Projectors and related accessories',50 union all
  select 'Video','Display','Professional displays and monitors',60 union all
  select 'Stage','Stage Platform','Stage decks and platforms',10 union all
  select 'Stage','Roof / Cover','Stage roofs and weather protection',20 union all
  select 'Stage','Stairs / Ramp','Stage stairs and ramps',30 union all
  select 'Stage','Barrier','Crowd barriers and stage barriers',40 union all
  select 'Rigging','Truss','Aluminum truss systems',10 union all
  select 'Rigging','Hoist','Hoists and lifting equipment',20 union all
  select 'Rigging','Clamp / Hardware','Clamps, couplers and rigging hardware',30 union all
  select 'Rigging','Safety','Safety wires and secondary securing',40 union all
  select 'Power','Distribution','Power distribution systems',10 union all
  select 'Power','Cable','Power cables and extensions',20 union all
  select 'Power','Generator','Generators and backup power',30 union all
  select 'Power','Protection','Protection and monitoring equipment',40 union all
  select 'Control','Network','Network switches, routers and infrastructure',10 union all
  select 'Control','Show Control','Show control and timecode equipment',20 union all
  select 'Control','Intercom','Wired and wireless intercom',30 union all
  select 'Cables','XLR','Balanced audio cables',10 union all
  select 'Cables','Speaker','Speaker and amplifier cables',20 union all
  select 'Cables','DMX','DMX cables',30 union all
  select 'Cables','Power','Power distribution cables',40 union all
  select 'Cables','Network','Ethernet and control network cables',50 union all
  select 'Cases','Flight Case','Equipment flight cases',10 union all
  select 'Cases','Rack Case','19-inch rack and processing cases',20 union all
  select 'Cases','Cable Case','Cable and accessory cases',30 union all
  select 'Tools','Test Equipment','Meters, testers and measurement tools',10 union all
  select 'Tools','Hand Tools','Installation and service tools',20 union all
  select 'Safety','PPE','Personal protective equipment',10 union all
  select 'Safety','Site Safety','Barricades, warning and site safety equipment',20
)
insert into public.equipment_subclasses(class_id,name,description,sort_order)
select c.id,s.name,s.description,s.sort_order from seeds s join classes c on c.name=s.class_name
on conflict (class_id,name) do update set description=excluded.description,sort_order=excluded.sort_order,active=true;
